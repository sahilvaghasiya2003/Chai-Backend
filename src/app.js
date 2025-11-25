import express from "express";
import cors from 'cors';
import cookieParser from "cookie-parser";

const app = express();

//use method is use for configure the middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

//limit the json data size
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))

//configuration to store temp file in public folder
app.use(express.static("public"))

//to read/write secure cookie
app.use(cookieParser())

//routes imports

import userRouter from './routes/user.routes.js'


//routes declaration
app.use("/api/v1/users",userRouter)


export { app };
