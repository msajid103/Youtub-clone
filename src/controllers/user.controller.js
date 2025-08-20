import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const refreshToken = user.generateRefreshTokekn();
        const accesToken = user.generateAccessTokekn();
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false});
        return { accesToken,refreshToken };
    } catch (error) {
        throw new ApiError(500,"Something Went wrong while generating Access or Refresh Token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend 
    // validation - not empty
    // check if user already exist: username or email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return res

    const { fullName, email, username, password } = req.body;

    if (
        [fullName, email, username, password].some((field) =>
            field?.trim() === "")
    ) {
        throw new ApiError(400, "All field are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    // const converImageLocalPath = req.files?.coverImage[0]?.path

    let converImageLocalPath;

    if (req.files 
    && Array.isArray(req.files.coverImage) 
    && req.files.coverImage.length > 0 ){
        converImageLocalPath = req.files?.coverImage[0]?.path
    }


    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }
    

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(converImageLocalPath)
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage : coverImage?.url || "",
        username: username.toLowerCase(),
        email,
        password
    })

    const createdUSer = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUSer){
        throw new ApiError(500, "Something went wrong while registering user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUSer,"User Register Successfully")
    )
})

const loginUSer = asyncHandler(asyncHandler( async (req, res)=>{
    // data from req body 
    // username or email
    // find the user
    // password check
    // access and refresh token 
    // send cookies
    const { email, username, password } = req.body;  
    if(!(username || email)){
        throw new ApiError(400, "username or email is required")
    }
    const user = await User.findOne({
        $or:[{ username }, { email }]
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid Credential")
    }

    const { accesToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const logedInUser = await User.findById(user._id)
    .select("-password, -refreshToken")
    const options = {
        httpOnly: true,
        secure: true,
    }
    return res
    .status(200)
    .cookie("accessToken",accesToken, options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: logedInUser, accesToken, refreshToken
            },
            "User logedIn Sucesfully"
        )
    )

}))

const logoutUSer = asyncHandler(async(req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { refreshToken: undefined}
        },
        {
            new: true
        }
    )

     const options = {
        httpOnly: true,
        secure: true,
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(
            200,
            {
              
            },
            "User logedOut Sucesfully"
        )
    )
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }
   try {
     const decodedToken = jwt.verify(
         incomingRefreshToken, 
         process.env.REFRESH_TOKEN_SECRET
     ) 
 
     const user = await User.findById(decodedToken?._id);
     if(!user){
         throw new ApiError(401, "Invalid request token")
     }
     if(incomingRefreshToken !== user.refreshToken){
         throw new ApiError(401, "Refresh token is expired or used")
     }
 
     const options = {
         httpOnly: true,
         secure: true
     }
 
     const { accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id);
 
     return res
     .status(200)
     .cookie("accessToken", accessToken, options)
     .cookie("refreshToken", newRefreshToken, options)
     .json(
         new ApiResponse(200,{accessToken, newRefreshToken}, "Access Token Refreshed Successfully" )
     )
   } catch (error) {
     throw new ApiError(401, error?.message || "Invalid request token")
   }
})
export { 
    registerUser,
    loginUSer,
    logoutUSer,
    refreshAccessToken
 };