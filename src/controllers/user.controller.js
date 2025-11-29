import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken'

const generateAccessAndRefreshTokens = async (userId) => {
  try {

    console.log(userId);
    
    const user = await User.findById(userId);
    console.log("User: ", user);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    
    //Add refreshtoken to db
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  //validation - not empty
  //check if user already exist: username, email
  //check for images, check for avatar
  //upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  //check for user creation
  //return res

  //get user details from frontend
  const { fullname, email, username, password } = req.body;
  // console.log("Email: ", email);

  //validation - not empty
  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //check if user already exist: username, email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exist.");
  }

  // console.log("files", req.files);

  //check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required.");
  }

  //upload them to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  // console.log("Avatar: ", avatar);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required.");
  }

  // create user object - create entry in db
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  //return res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created successfully..."));
});

const loginUser = asyncHandler(async (req, res) => {
  //req body > data
  const { email, username, password } = req.body;

  console.log(email);
  
  if (!username && !email) {
    throw new ApiError(400, "username or password is required.");
  }

  //username/email is there or not
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  //find user exist or not
  if (!user) {
    throw new ApiError(404, "User does not exist.");
  }

  //password compare
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials.");
  }

  //access and refresh token
  const { refreshToken, accessToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //send cookie
  const options = {
    httpOnly: true,
    secure: false,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req,res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {new: true}
  )

  const options = {
    httponly: true,
    secure: true,
  };

  return res
  .status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200, {}, "User logged out."))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken) {
    throw new ApiError(401,"Unauthorized request.")
  }

  //compare the refresh token
  try {
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
  
    const user = User.findById(decodedToken?._id)
  
    if(!user) {
      throw new ApiError(401,"Invalid refresh token.")
    }
  
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used")
    }
  
    const options = {
      httpOnly: true,
      secure: true
    }
  
    const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        {accessToken, refreshToken: newRefreshToken},
        "Access token refreshed"
      )
    )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access Token")
  }
  
})


export { registerUser, loginUser, logoutUser, refreshAccessToken };
