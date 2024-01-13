import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getAllVideos } from "./video.controller.js";
import { ObjectId } from "mongodb";

const getChannelStats = asyncHandler(async (req, res) => {
  const totalVideos = await Video.countDocuments({ owner: req.user?._id });

  const totalSubscribers = await Subscription.countDocuments({
    channel: req.user?._id,
  });

  const totalViews = await Video.aggregate([
    {
      $match: {
        owner: new ObjectId(req.user?._id),
      },
    },
    {
      $group: {
        _id: null,
        TotalView: {
          $sum: "$views",
        },
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
  ]);

  const totalVideoLikes = await Video.aggregate([
    {
      $match: {
        owner: new ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        likes: {
          $size: "$likes",
        },
      },
    },
    {
      $group: {
        _id: null,
        likes: {
          $sum: "$likes",
        },
      },
    },
    {
      $project: {
        likes: 1,
        _id: 0,
      },
    },
  ]);

  const result = {
    totalSubscribers,
    totalVideoLikes: totalVideoLikes?.[0]?.likes,
    totalVideos,
    totalViews: totalViews?.[0]?.TotalView,
  };
  res.status(200).json(new ApiResponse(200, result));
});

const getChannelVideos = asyncHandler(async (req, res) => {
  req.query.userId = req.user.id;
  getAllVideos(req, res);
});

export { getChannelStats, getChannelVideos };
