import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ObjectId } from "mongodb";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  // check if the Channel Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(channelId))
    throw new ApiError(404, "Invalid Channel");

  // check if Channel exist
  const doesChannelExist = await User.findById(channelId);
  if (!doesChannelExist) {
    throw new ApiError(404, "Channel not found");
  }

  // Search in Subscription model
  const subscribedUser = await Subscription.find({
    channel: channelId,
    subscriber: req.user?._id,
  });

  // Toggle subscription based on condition
  if (subscribedUser && subscribedUser?.length) {
    await Subscription.deleteOne({
      subscriber: req.user?._id,
      channel: channelId,
    });

    res.status(200).json(new ApiResponse(200, {}, "unsubscribed successfully"));
  } else {
    await Subscription.create({
      subscriber: req.user?._id,
      channel: channelId,
    });

    res.status(200).json(new ApiResponse(200, {}, "Subscribed successfully"));
  }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  // check if the Channel Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(channelId))
    throw new ApiError(404, "Invalid channel");

  // check if Channel exist
  const doesChannelExist = await User.findById(channelId);
  if (!doesChannelExist) {
    throw new ApiError(404, "Channel not found");
  }

  const subscribers = await Subscription.aggregate([
    // match by channel to get all subscriber
    {
      $match: {
        channel: new ObjectId(channelId),
      },
    },
    // connect users collection with subscription collection
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "user",
      },
    },
    // unwind all user
    {
      $unwind: "$user",
    },
    // select specific field to display
    {
      $project: {
        username: "$user.username",
        email: "$user.email",
        fullName: "$user.fullName",
        avatar: "$user.avatar",
      },
    },
  ]);
  res.status(200).json(new ApiResponse(200, subscribers));
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  // check if the User Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(subscriberId))
    throw new ApiError(404, "Invalid User");

  // check if User exist
  const doesUserExist = await User.findById(subscriberId);
  if (!doesUserExist) {
    throw new ApiError(404, "Invalid User");
  }

  const channels = await Subscription.aggregate([
    // match by subscriber to get all Channels
    {
      $match: {
        subscriber: new ObjectId(subscriberId),
      },
    },
    // connect users collection with subscription collection
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "user",
      },
    },
    // unwind all user
    {
      $unwind: "$user",
    },
    // select specific field to display
    {
      $project: {
        username: "$user.username",
        email: "$user.email",
        fullName: "$user.fullName",
        avatar: "$user.avatar",
      },
    },
  ]);
  res.status(200).json(new ApiResponse(200, channels));
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
