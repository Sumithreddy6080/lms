import { getAuth } from "@clerk/express";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Purchase from "../models/Purchase.js";
import Stripe from "stripe";
import CourseProgress from "../models/CourseProgress.js";

//for getting user data
export const getUserData = async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }
    const userId = auth.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    res.json({
      message: "User data retrieved successfully",
      success: true,
      user,
    });
  } catch (error) {
    // console.error("Error retrieving user data:", error);
    res.status(500).json({
      message: "Error retrieving user data",
      error: error.message,
      success: false,
    });
  }
};

//user enrolled courese with lecture links
export const userEnrolledCourses = async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }

    const userId = auth.userId;
    const userData = await User.findById(userId).populate("enrolledCourses");

    res.json({
      success: true,
      message: "Enrolled courses retrieved successfully",
      enrolledCourses: userData.enrolledCourses,
    });
  } catch (error) {
    console.error("Error retrieving enrolled courses:", error);
    res.status(500).json({
      message: "Error retrieving enrolled courses",
      error: error.message,
      success: false,
    });
  }
};

//purchase course
export const purchaseCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const { origin } = req.headers;
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }
    const userId = auth.userId;
    const userData = await User.findById(userId);
    const courseData = await Course.findById(courseId);

    if (!courseData && !userData) {
      return res.status(404).json({
        message: "Course or User not found",
        success: false,
      });
    }
    const purchaseData = {
      courseId: courseData._id,
      userId,
      amount: (
        courseData.coursePrice -
        (courseData.discount * courseData.coursePrice) / 100
      ).toFixed(2),
    };

    const newPurchase = await Purchase.create(purchaseData);

    //stripe gateway initialization
    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    const currency = process.env.CURRENCY.toLowerCase();

    //creating line items to fo stripe
    const lineItems = [
      {
        price_data: {
          currency,
          product_data: {
            name: courseData.couresTitle || "Course Purchase",
          },
          unit_amount: Math.floor(newPurchase.amount) * 100,
        },
        quantity: 1,
      },
    ];
    // console.log(origin)
    const session = await stripeInstance.checkout.sessions.create({
      success_url: `${origin}/loading/my-enrollments`,
      cancel_url: `${origin}`,
      line_items: lineItems,
      mode: "payment",
      metadata: {
        purchaseId: newPurchase._id.toString(),
      },
    });
    console.log("Session created successfully:", session.id);
    res.json({
      success: true,
      session_url: session.url,
    });
  } catch (error) {
    console.error("Error purchasing course:", error.message);
    res.status(500).json({
      message: "Error purchasing course",
      error: error.message,
      success: false,
    });
  }
};

//update user course progress
export const updateUserCourseProgress = async (req, res) => {
  try {
    const { courseId, lectureId } = req.body;
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }
    const userId = auth.userId;
    const progressData = await CourseProgress.findOne({ userId, courseId });

    if (progressData) {
      if (progressData.lecturecompleted.includes(lectureId)) {
        return res.json({
          message: "Lecture already completed",
          success: true,
        });
      }
      progressData.lecturecompleted.push(lectureId);
      await progressData.save();
    } else {
      await CourseProgress.create({
        userId,
        courseId,
        lecturecompleted: [lectureId],
      });
    }

    res.json({
      message: "Course progress updated successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating course progress",
      error: error.message,
      success: false,
    });
  }
};

//get user course progress
export const getUserCourseProgress = async (req, res) => {
  try {
    const { courseId, lectureId } = req.body;
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }

    const userId = auth.userId;
    const progressData = await CourseProgress.findOne({ userId, courseId });
    res.json({
      message: "Course progress retrieved successfully",
      success: true,
      progress: progressData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving course progress",
      error: error.message,
      success: false,
    });
  }
};

//add user rating for course
export const addUserRating = async (req, res) => {
  try {
    const { courseId, rating } = req.body;
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }
    if (!courseId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Invalid courseId or rating",
        success: false,
      });
    }

    const userId = auth.userId;
    const courseData = await Course.findById(courseId);
    if (!courseData) {
      return res.status(404).json({
        message: "Course not found",
        success: false,
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.enrolledCourses.includes(courseId)) {
      return res.status(403).json({
        message: "User not enrolled in this course",
        success: false,
      });
    }

    const existingRatingIndex = courseData.courseRatings.findIndex(
      (rating) => rating.userId.toString() === userId.toString()
    );
    if (existingRatingIndex > 1) {
      courseData.courseRatings[existingRatingIndex].rating = rating;
    } else {
      courseData.courseRatings.push({ userId, rating });
    }
    await courseData.save();
    res.json({
      message: "Rating added successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error adding rating",
      error: error.message,
      success: false,
    });
  }
};
