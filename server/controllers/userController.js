import { getAuth } from "@clerk/express";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Purchase from "../models/Purchase.js";
import Stripe from "stripe";

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

    const session = await stripeInstance.checkout.sessions.create({
        success_url: `${origin}loading/my-enrollments`,
        cancel_url: `${origin}`,
        line_items: lineItems,
        mode: "payment",
        metadata: {
          purchaseId: newPurchase._id.toString()
        },
    });

    res.json({
        success: true,
        session_url : session.url,
    });


  } catch (error) {
    console.error("Error purchasing course:", error);
    res.status(500).json({
      message: "Error purchasing course",
      error: error.message,
      success: false,
    });
  }
};

