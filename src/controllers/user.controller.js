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
  httpOnly: true,
  secure: true,
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
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar field is required");
  } else {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
      throw new ApiError(400, "Avatar field is required");
    }
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
    avatar: avatar.url,
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
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username && !password) {
    throw new ApiError(400, "Username or email is required!");
  }

  const user = await User.findOne({ $or: [{ username, email }] });
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
    .cookie("refreshToken", refreshToken, cookiesOptions)
    .json(
      new ApiResponse(
        200,
        { user: validateUser, accessToken, refreshToken },
        "User login successfull"
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
      .cookie("accessToken", accessToken)
      .cookie("refreshToken", refreshToken)
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
  console.log("req", req);
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
      $set: { refreshToken: undefined },
    },
    { new: true }
  );

  return res
    .status(200)
    .clearCookie("accessToken", cookiesOptions)
    .clearCookie("refreshToken", cookiesOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export {
  getCurrentUser,
  registerUser,
  loginUser,
  refreshAccessToken,
  changeCurrentPassword,
  updateAccountInfo,
  updateUserAvatar,
  updateCoverImage,
  logoutUser,
};
