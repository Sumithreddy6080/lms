import { clerkClient, getAuth } from "@clerk/express";
import Course from "../models/Course.js";
import { v2 as cloudinary } from "cloudinary";
import Purchase from "../models/Purchase.js";
import User from "../models/User.js";

// This controller handles the update of user roles to 'educator' in Clerk
export const updateRoleToEducator = async (req, res) => {
  try {
    const auth = getAuth(req);
    // console.log("Auth data:", auth);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }

    const userId = auth.userId;
    // console.log("User ID:", userId);

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: "educator",
      },
    });

    res.json({
      message: "User role updated to educator successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({
      message: "Error updating user role",
      error: error.message,
      success: false,
    });
  }
};

// add new couorse
export const addCourse = async (req, res) => {
  try {
    const { courseData } = req.body;
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({
        message: "Image file is required",
        success: false,
      });
    }

    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }
    const educatorId = auth.userId;

    const parasedCourseData = await JSON.parse(courseData);
    parasedCourseData.educator = educatorId;

    const newCourse = await Course.create(parasedCourseData);
    console.log(parasedCourseData);

    const imageUpload = await cloudinary.uploader.upload(imageFile.path);
    newCourse.courseThumbnail = imageUpload.secure_url;
    await newCourse.save();

    res.json({
      message: "Course added successfully",
      course: newCourse,
      success: true,
    });
  } catch (error) {
    console.error("Error adding course:", error);
    res.status(500).json({
      message: "Error adding course",
      error: error.message,
      success: false,
    });
  }
};

// get educator courses
export const getEducatorCourses = async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }

    const educatorId = auth.userId;
    const courses = await Course.find({ educator: educatorId });

    res.json({
      message: "Courses retrieved successfully",
      courses,
      success: true,
    });
  } catch (error) {
    console.error("Error retrieving courses:", error);
    res.status(500).json({
      message: "Error retrieving courses",
      error: error.message,
      success: false,
    });
  }
};

//get educator dashboard data
export const educatorDashboardData = async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }
    
    const educatorId = auth.userId;

    const courses = await Course.find({ educator: educatorId });
    const totalCourses = courses.length;
    const courseIds = courses.map((course) => course._id);

    const purchases = await Purchase.find({
      courseId: { $in: courseIds },
      status: "completed",
    });
    const totalEarnings = purchases.reduce(
      (total, purchase) => total + purchase.amount,
      0
    );

    //collect unique enrolled student ids with their course tiles
    const enrolledStudentsData = [];
    for (const course of courses) {
      const students = await User.find(
        { _id: { $in: course.enrolledStudents } },
        "name imageUrl"
      );
      students.forEach((student) => {
        enrolledStudentsData.push({
          courseTitle: course.courseTitle,
          student,
        });
      });
    }

    res.json({
      message: "Dashboard data retrieved successfully",
      dashboardData: {
        totalCourses,
        totalEarnings,
        enrolledStudentsData,
      },
      success: true,
    });
  } catch (error) {
    console.error("Error retrieving dashboard data:", error);
    res.status(500).json({
      message: "Error retrieving dashboard data",
      error: error.message,
      success: false,
    });
  }
};

//get enrolled students data with purchase data
export const getEnrolledStudentsData = async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }
    const educatorId = auth.userId;
    const courses = await Course.find({ educator: educatorId });

    const courseIds = courses.map((course) => course._id);
    const purchases = await Purchase.find({
      courseId: { $in: courseIds },
      status: "completed",
    }).populate("userId", "name imageUrl").populate("courseId", "courseTitle");

    const enrolledStudentsData = purchases.map((purchase) => ({
      student: purchase.userId,
      courseTitle: purchase.courseId.courseTitle,
       purchaseDate: purchase.createdAt,
    }));

    res.json({
      message: "Enrolled students data retrieved successfully",
      enrolledStudentsData,
      success: true,
    });
  } catch (error) {
    console.error("Error retrieving enrolled students data:", error);
    res.status(500).json({
      message: "Error retrieving enrolled students data",
      error: error.message,
      success: false,
    });
  }
};