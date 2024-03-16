import { User } from "../models/user.model.js";
import ApiError from "../utils/error.js";
import asyncHandler from "../utils/async.js";
import { uploadOnCloudinary } from "../utils/coludinary.js";

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
  res.status(201).json(createdUser);
});
export { registerUser };
