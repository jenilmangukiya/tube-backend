import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ObjectId } from "mongodb";
import { Video } from "../models/video.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    throw new ApiError(404, "Name and description are required");
  }

  const playlist = await Playlist.create({
    name: name,
    description: description,
    owner: req.user?._id,
  });

  res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // check if the User Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(userId))
    throw new ApiError(404, "Invalid user");

  const playlist = await Playlist.find({ owner: userId });

  res.status(200).json(new ApiResponse(200, playlist));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  // check if the User Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(playlistId))
    throw new ApiError(404, "Invalid Playlist");

  const playlist = await Playlist.findById(playlistId);

  res.status(200).json(new ApiResponse(200, playlist));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  // check if the Playlist Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(playlistId))
    throw new ApiError(404, "Invalid Playlist");

  // check if the Video Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(404, "Invalid Video");

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $addToSet: { videos: new ObjectId(videoId) },
    },
    { new: true }
  );

  if (!playlist) {
    throw new ApiError("Playlist not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, playlist, "Video added to playlist"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  // check if the Playlist Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(playlistId))
    throw new ApiError(404, "Invalid Playlist");

  // check if the video Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(404, "Invalid Video");

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: { videos: new ObjectId(videoId) },
    },
    { new: true }
  );

  if (!playlist) {
    throw new ApiError("Playlist not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, playlist, "Video removed from playlist"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  // check if the playlist Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(playlistId))
    throw new ApiError(404, "Invalid Playlist");

  const playlist = await Playlist.findByIdAndDelete(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  res.status(200).json(new ApiResponse(200, playlist));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  // check if the playlist Id is in correct format
  if (!mongoose.Types.ObjectId.isValid(playlistId))
    throw new ApiError(404, "Invalid Playlist");

  if (!name && !description) {
    throw new ApiError(400, "Name and description are required");
  }

  const updateFields = {};
  if (name) {
    updateFields.name = name;
  }

  if (description) {
    updateFields.description = description;
  }

  const playlist = await Playlist.findByIdAndUpdate(playlistId, updateFields, {
    new: true,
  });

  if (!playlist) {
    throw new ApiError(404, "No playlist found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, playlist, "playlist updated successfully"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
