import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ObjectId } from "mongodb";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, "Content is Required");
  }

  const tweet = await Tweet.create({
    content,
    owner: req.user._id,
  });

  if (!tweet) {
    throw new ApiError(400, "Failed to tweet!,please try again");
  }

  res.status(200).json(new ApiResponse(201, tweet, "Tweeted successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // check if the User Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(userId))
    throw new ApiError(404, "Invalid user");

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
  const pipeline = Tweet.aggregate([
    {
      $match: { owner: new ObjectId(userId) },
    },
    {
      $sort: { [sortBy]: sortOrder },
    },
    {
      $skip: (+page - 1) * +limit,
    },
    {
      $limit: +limit,
    },
  ]);

  const paginatedTweets = await Tweet.aggregatePaginate(pipeline, options);
  if (!paginatedTweets) {
    throw new ApiError(400, "Failed to load Tweets!, Please try again ");
  }

  res.status(200).json(new ApiResponse(200, paginatedTweets));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  // check if the tweet Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(tweetId))
    throw new ApiError(404, "Invalid Tweet");

  if (!content) {
    throw new ApiError(200, "Content is required");
  }

  const UpdatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    { $set: { content: content } },
    { new: true }
  );

  if (!UpdatedTweet) {
    throw new ApiError(200, "Failed to update Tweet please Try Again!");
  }
  res
    .status(200)
    .json(new ApiResponse(200, UpdatedTweet, "Tweet updated Successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  // check if the Tweet Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(tweetId))
    throw new ApiError(404, "Invalid Tweet");

  const tweet = await Tweet.findByIdAndDelete(tweetId);

  if (!tweet) {
    throw new ApiError("Failed to delete Tweet!, Please try again");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Comment deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
