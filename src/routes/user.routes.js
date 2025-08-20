import { Router } from "express";
import { loginUSer, logoutUSer, registerUser, refreshAccessToken } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUSer)


// secured routes
router.route("/logout").post( verifyJWT, logoutUSer)
router.route("/refresh-token").post(refreshAccessToken)


router.route("/test").post( verifyJWT, (req, res)=>{
    res.send(`Tested: ${req.body.username}`)
})

export default router