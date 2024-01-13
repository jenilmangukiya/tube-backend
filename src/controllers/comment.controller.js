import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ObjectId } from "mongodb";

// TODO: Need to restrict user by USERID

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortType = "desc",
  } = req.query;

  if (!mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(404, "Invalid Video");

  const options = {
    page: +page,
    limit: +limit,
  };

  const sortOrder = sortType.toLowerCase() === "desc" ? -1 : 1;
  const pipeline = Comment.aggregate([
    {
      $match: { video: new ObjectId(videoId) },
    },
    {
      $sort: { [sortBy]: sortOrder },
    },
  ]);

  const paginatedComments = await Comment.aggregatePaginate(pipeline, options);
  if (!paginatedComments) {
    throw new ApiError(400, "Failed to load comments!, Please try again ");
  }

  res.status(200).json(new ApiResponse(200, paginatedComments));
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  // check if the Video Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(404, "Invalid Video");

  if (!content) {
    throw new ApiError(400, "Content is Required");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user?._id,
  });

  res.status(200).json(new ApiResponse(201, comment, "Commented successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  // check if the Comment Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(commentId))
    throw new ApiError(404, "Invalid Comment");

  if (!content) {
    throw new ApiError(200, "Content is required");
  }

  const comment = await Comment.findByIdAndUpdate(
    commentId,
    { $set: { content: content } },
    { new: true }
  );

  if (!comment) {
    throw new ApiError(200, "Failed to update Comment please Try Again!");
  }
  res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment updated Successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  // check if the Comment Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(commentId))
    throw new ApiError(404, "Invalid Comment");

  const comment = await Comment.findByIdAndDelete(commentId);

  if (!comment) {
    throw new ApiError("Failed to delete Comment!, Please try again");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
