import { User } from "../models/user.model.js";
import ApiError from "../utils/error.js";
import asyncHandler from "../utils/async.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "error while generating access and refresh token");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, fullName, password } = req.body;
  const isUserExist = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (isUserExist) {
    throw new ApiError(500, "Username or email already exist");
  }

  let avatarLocalPath = "";
  if (req?.files?.avatar?.[0]?.path) {
    avatarLocalPath = req.files.avatar[0].path;
  }

  let coverImageLocalPath = "";
  if (req?.files?.coverImage?.[0]?.path) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  const user = await User.create({
    fullName,
    email,
    password,
    username: username.toString(),
    avatar: avatar?.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findOne({ _id: user._id }).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating user");
  }
  res.status(201).json(createdUser);
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  if (!(email || username) || !password) {
    throw new ApiError(400, "email or username and password is required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (!user) {
    throw new ApiError(404, "email or username does not exist");
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new ApiError(500, "Authentacition Failed! INVALID Password");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  res
    .status(200)
    .cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
    })
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
    })
    .json({
      userId: user._id,
      accessToken,
      refreshToken,
      msg: "user logged in successfully",
    });
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $set: {
        refreshToken: undefined,
      },
    },
    { new: true }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json("logged out successfully");
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }
  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or used");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const option = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshToken, option)
    .json({ accessToken, refreshToken, msg: "Access token refreshed" });
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw new ApiError(401, "Please provide oldPassword and newPassword");
  }
  const user = await User.findById(req.user._id);

  const isValidPassword = await user.comparePassword(oldPassword);
  if (!isValidPassword) {
    throw new ApiError(401, "Invalid password");
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({ msg: "Password changed successfully" });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  const user = await User.findByIdAndUpdate(
    { _id: req.user._id },
    { fullName, email },
    { new: true }
  ).select("-password -refreshToken");
  res.status(200).json({ user, msg: "Account details updated successfully" });
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const path = req.file?.path;
  if (!path) {
    throw new ApiError(401, "Please provide avatar image");
  }
  //delete previous image before uploading new image from cloudinary
  const currentUser = await User.findById(req.user._id);
  const currentAvatar = currentUser.avatar;
  const startIndex = currentAvatar.lastIndexOf("/") + 1;
  const endIndex = currentAvatar.lastIndexOf(".");
  const avatarId = currentAvatar.substring(startIndex, endIndex);

  const avatar = await uploadOnCloudinary(path);
  if (!avatar.url) {
    throw new ApiError(401, "Error while uploading avatar");
  }
  //delete previous file
  await cloudinary.uploader.destroy(avatarId);

  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
  res.status(200).json({ user, msg: "avatar changed successfully" });
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const path = req.file?.path;
  if (!path) {
    throw new ApiError(401, "Please provide cover image");
  }
  const coverImage = await uploadOnCloudinary(path);
  if (!coverImage.url) {
    throw new ApiError(401, "Error while uploading cover image");
  }
  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");
  res.status(200).json({ user, msg: "cover image changed successfully" });
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
