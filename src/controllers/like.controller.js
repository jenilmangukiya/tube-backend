import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ObjectId } from "mongodb";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // check if the Video Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(404, "Invalid Video");

  // check if Video exist
  const doesVideoExist = await Video.findById(videoId);
  if (!doesVideoExist) {
    throw new ApiError(404, "Video not found");
  }

  // Search in model
  const LikedVideo = await Like.find({
    video: videoId,
    likedBy: req.user?._id,
  });

  // Toggle
  let result = null;
  let liked = false;
  if (LikedVideo && LikedVideo?.length) {
    result = await Like.deleteOne({
      video: videoId,
      likedBy: req.user?._id,
    });
    liked = false;
  } else {
    result = await Like.create({
      likedBy: req.user?._id,
      video: videoId,
    });
    liked = true;
  }
  if (!result) {
    throw new ApiError(400, "Failed please try again");
  }

  const totalLikes = await Like.countDocuments({ video: videoId });
  if (liked) {
    res
      .status(200)
      .json(
        new ApiResponse(200, { liked, likes: totalLikes }, "Liked Successfully")
      );
  } else {
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { liked, likes: totalLikes },
          "Unliked successfully!"
        )
      );
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  // check if the Comment Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(commentId))
    throw new ApiError(404, "Invalid comment");

  // check if Video exist
  const doesCommentExist = await Comment.findById(commentId);
  if (!doesCommentExist) {
    throw new ApiError(404, "Comment not found");
  }

  // Search in model
  const LikedComment = await Like.find({
    comment: commentId,
    likedBy: req.user?._id,
  });

  // Toggle
  let result = null;
  let liked = false;
  if (LikedComment && LikedComment?.length) {
    result = await Like.deleteOne({
      comment: commentId,
      likedBy: req.user?._id,
    });
    liked = false;
  } else {
    result = await Like.create({
      likedBy: req.user?._id,
      comment: commentId,
    });
    liked = true;
  }
  if (!result) {
    throw new ApiError(400, "Failed please try again");
  }

  const totalLikes = await Like.countDocuments({ comment: commentId });
  if (liked) {
    res
      .status(200)
      .json(
        new ApiResponse(200, { liked, likes: totalLikes }, "Liked Successfully")
      );
  } else {
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { liked, likes: totalLikes },
          "Unliked successfully!"
        )
      );
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  // check if the Comment Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(tweetId))
    throw new ApiError(404, "Invalid tweet");

  // check if Video exist
  const doesTweetExist = await Tweet.findById(tweetId);
  if (!doesTweetExist) {
    throw new ApiError(404, "Tweet not found");
  }

  // Search in model
  const LikedTweet = await Like.find({
    tweet: tweetId,
    likedBy: req.user?._id,
  });

  // Toggle
  let result = null;
  let liked = false;
  if (LikedTweet && LikedTweet?.length) {
    result = await Like.deleteOne({
      tweet: tweetId,
      likedBy: req.user?._id,
    });
    liked = false;
  } else {
    result = await Like.create({
      likedBy: req.user?._id,
      tweet: tweetId,
    });
    liked = true;
  }
  if (!result) {
    throw new ApiError(400, "Failed please try again");
  }

  const totalLikes = await Like.countDocuments({ tweet: tweetId });
  if (liked) {
    res
      .status(200)
      .json(
        new ApiResponse(200, { liked, likes: totalLikes }, "Liked Successfully")
      );
  } else {
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { liked, likes: totalLikes },
          "Unliked successfully!"
        )
      );
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortType = "desc",
  } = req.query;

  const options = {
    page: +page,
    limit: +limit,
  };

  const sortOrder = sortType.toLowerCase() === "desc" ? -1 : 1;

  const pipeline = Like.aggregate([
    {
      $match: {
        likedBy: new ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
      },
    },
    {
      $unwind: "$video",
    },
    {
      $project: {
        video: 1,
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: ["$video"],
        },
      },
    },
    {
      $sort: { [sortBy]: sortOrder },
    },
  ]);

  const paginatedVideos = await Like.aggregatePaginate(pipeline, options);
  if (!paginatedVideos) {
    throw new ApiError(400, "Failed to load Liked Videos!, Please try again ");
  }

  res.status(200).json(new ApiResponse(200, paginatedVideos));
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
