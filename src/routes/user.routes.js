import { Router } from "express";
import {
  changeCurrentPassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateCoverImage,
  updateUserAvatar,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

router.route("/getCurrentUser").post(verifyJWT, getCurrentUser);

router.route("/refreshAccessToken").post(refreshAccessToken);

router.route("/changeCurrentPassword").post(verifyJWT, changeCurrentPassword);

router
  .route("/updateUserAvatar")
  .post(upload.single("avatar"), verifyJWT, updateUserAvatar);

router
  .route("/updateCoverImage")
  .post(upload.single("coverImage"), verifyJWT, updateCoverImage);

router.route("/logout").post(verifyJWT, logoutUser);

export default router;
