import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  removeFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  const aggregation = [];

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    aggregation.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  if (query) {
    aggregation.push({
      $match: {
        $or: [
          { title: { $regex: new RegExp(query, "i") } },
          { description: { $regex: new RegExp(query, "i") } },
        ],
      },
    });
  }

  if (
    sortBy &&
    ["title", "duration", "views", "isPublished", "createdAt"].includes(sortBy)
  ) {
    const sortOrder = sortType.toLowerCase() === "desc" ? -1 : 1;
    aggregation.push({
      $sort: {
        [sortBy]: sortOrder,
      },
    });
  }

  const options = {
    page: +page,
    limit: +limit,
  };

  const pipeline = Video.aggregate(aggregation);

  const videosPaginated = await Video.aggregatePaginate(pipeline, options);

  res.status(200).json(new ApiResponse(200, videosPaginated));
});

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    throw new ApiError(400, "title and description is required");
  }

  const videoFileLocal = req.files?.videoFile?.[0].path;
  if (!videoFileLocal) {
    throw new ApiError(400, "Video File is required");
  }

  const thumbnailLocal = req.files?.thumbnail?.[0].path;
  if (!thumbnailLocal) {
    throw new ApiError(400, "Thumbnail is required");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocal);
  if (!videoFile) {
    throw new ApiError(500, "something went wrong while uploading videoFile");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocal);
  if (!thumbnail) {
    throw new ApiError(500, "something went wrong while uploading Thumbnail");
  }

  const video = await Video.create({
    videoFile: videoFile?.url || "",
    thumbnail: thumbnail?.url || "",
    owner: req.user?._id,
    title: title,
    description: description,
    duration: videoFile?.duration || 0,
    views: 0,
    isPublished: true,
  });

  res
    .status(201)
    .json(new ApiResponse(201, video, "Video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // check if the Video Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(404, "Invalid Video");

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, null, "No video found");
  }
  res.status(200).json(new ApiResponse(200, video, "success"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // check if the Video Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(404, "Invalid Video");

  const allowedFields = ["title", "description"];

  // Filter the update payload to include only allowed fields
  const filteredUpdate = Object.keys(req.body)
    .filter((key) => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = req.body[key];
      return obj;
    }, {});

  if (req.file?.path) {
    const thumbnail = await uploadOnCloudinary(req.file?.path);
    if (thumbnail) {
      const oldThumbnail = await Video.findById(videoId)?.thumbnail;
      filteredUpdate["thumbnail"] = thumbnail?.url;
      await removeFromCloudinary(oldThumbnail);
    }
  }

  if (!Object.keys(filteredUpdate).length) {
    throw new ApiError(404, "Nothing to update");
  }

  const video = await Video.findByIdAndUpdate(
    videoId,
    { $set: filteredUpdate },
    { new: true }
  );

  res.status(200).json(new ApiResponse(200, video, "Updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // check if the Video Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(404, "Invalid Video");

  const videoDetails = await Video.findById(videoId);
  if (!videoDetails) {
    throw new ApiError(404, "video Not found");
  }

  if (videoDetails?.owner !== req.user._id) {
    throw new ApiError(401, "unAuthorized to Delete Video");
  }

  const deletedVideo = await Video.findByIdAndDelete(videoId);

  // TODO: need to improve more
  if (deletedVideo?.thumbnail)
    await removeFromCloudinary(deletedVideo?.thumbnail);
  if (deletedVideo?.videoFile)
    await removeFromCloudinary(deletedVideo?.videoFile, "video");

  res
    .status(200)
    .json(new ApiResponse(200, deletedVideo, "Deleted Successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // check if the Video Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(404, "Invalid Video");

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "No video found");
  }

  video.isPublished = !video.isPublished;
  const updatedVideo = await video.save();

  res.status(200).json(new ApiResponse(200, updatedVideo, "success"));
});

export {
  getAllVideos,
  publishVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
