import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import {
  uploadOnCloudinary,
  removeFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "./../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const cookiesOptions = {
  secure: true,
  maxAge: 24 * 60 * 60 * 1000, // For 1d
};

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while creating access and refresh Token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, password, fullName, email } = req.body;

  // Check for the All field are provided or not
  if (
    [username, password, fullName, email].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All field are required");
  }

  // Check if user Already Exist
  const userExist = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (userExist) {
    throw new ApiError(409, "Username or email already exist");
  }

  // Check for avatar path and upload it to cloudinary
  let avatar;
  if (
    req.files &&
    Array.isArray(req.files?.avatar) &&
    req.files.avatar.length > 0
  ) {
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    avatar = await uploadOnCloudinary(avatarLocalPath);
  }

  // Check for cover Image
  let coverImage = "";
  if (
    req.files &&
    Array.isArray(req.files?.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }

  // Create user in DB
  const user = await User.create({
    username: username.toLowerCase(),
    fullName,
    email,
    avatar: avatar?.url || "",
    coverImage: coverImage?.url || "",
    password,
  });

  // Get User detail from DB that we just created
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating User");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { user: createdUser },
        "User registered Successfully"
      )
    );
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "Username or email is required!");
  }

  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) {
    throw new ApiError(404, "Username or email does not exist");
  }

  const isUserValid = await user.isPasswordCorrect(password);

  if (!isUserValid) {
    throw new ApiError(401, "Please enter valid password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const validateUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookiesOptions)
    .cookie("refreshToken", refreshToken, {
      ...cookiesOptions,
      maxAge: 10 * 24 * 60 * 60 * 1000, // For 10d
    })
    .json(
      new ApiResponse(
        200,
        { user: validateUser, accessToken, refreshToken },
        "User login successful"
      )
    );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized Request");
  }

  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const currentTimeInSeconds = Math.floor(Date.now() / 1000); // Convert to seconds

  if (decodedToken?.exp < currentTimeInSeconds) {
    throw new ApiError(401, "Refresh Token is expired");
  }

  try {
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (user.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { refreshToken, accessToken } = await generateAccessAndRefreshToken(
      user._id
    );

    res
      .status(200)
      .cookie("accessToken", accessToken, cookiesOptions)
      .cookie("refreshToken", refreshToken, {
        ...cookiesOptions,
        maxAge: 10 * 24 * 60 * 60 * 1000, // For 10d
      })
      .json(
        new ApiResponse(
          200,
          { refreshToken, accessToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Old Password");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Password change successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id).select(
    "-password -refreshToken"
  );
  res.status(200).json(new ApiResponse(200, user, "success"));
});

const updateAccountInfo = asyncHandler(async (req, res) => {
  const { email, fullName } = req.body;

  if (!email || !fullName) {
    throw new ApiError(400, "email and fullName is required");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        email,
        fullName,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  if (!user) {
    throw new ApiError(500, "Internal server error");
  }

  res.status(200).json(new ApiResponse(200, user, "User updated Successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarFile = req.file?.path;
  if (!avatarFile) {
    throw new ApiError(400, "Avatar is required");
  }

  const uploadedAvatar = await uploadOnCloudinary(avatarFile);
  if (!uploadedAvatar.url) {
    throw new ApiError(500, "something went wrong");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: uploadedAvatar.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  await removeFromCloudinary(req.user?.avatar);

  return res.status(200).json(new ApiResponse(200, user, "Avatar updated"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImage = req.file?.path;
  if (!coverImage) {
    throw new ApiError(400, "Cover image is required");
  }

  const uploadedCover = await uploadOnCloudinary(coverImage);
  if (!uploadedCover.url) {
    throw new ApiError(500, "something went wrong");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: uploadedCover.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated"));
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: 1 },
    },
    { new: true }
  );

  return res
    .status(200)
    .clearCookie("accessToken", cookiesOptions)
    .clearCookie("refreshToken", cookiesOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username) {
    throw new ApiError(400, "Username is required");
  }

  const channelInfo = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        channelsSubscribedToCount: { $size: "$subscribers" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channelInfo?.length) {
    throw new ApiError(400, "something went wrong");
  }

  return res.status(200).json(new ApiResponse(200, channelInfo, "success"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  getCurrentUser,
  getUserChannelProfile,
  getWatchHistory,
  registerUser,
  loginUser,
  refreshAccessToken,
  changeCurrentPassword,
  updateAccountInfo,
  updateUserAvatar,
  updateCoverImage,
  logoutUser,
};
