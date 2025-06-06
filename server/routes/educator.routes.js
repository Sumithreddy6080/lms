import express from "express";
import {
  addCourse,
  educatorDashboardData,
  getEducatorCourses,
  getEnrolledStudentsData,
  updateRoleToEducator,
} from "../controllers/educatorController.js";
import upload from "../configs/multer.js";
import { protectEducator } from "../middleware/authMiddlware.js";

const educatorRouter = express.Router();

// Use requireAuth middleware to ensure authentication
educatorRouter.get("/update-role", updateRoleToEducator);
educatorRouter.post("/add-course",upload.single("image"),protectEducator,addCourse);
educatorRouter.get("/courses", protectEducator, getEducatorCourses);
educatorRouter.get("/dashboard", protectEducator, educatorDashboardData);
educatorRouter.get("/enrolled-students",protectEducator,getEnrolledStudentsData);

export default educatorRouter;
