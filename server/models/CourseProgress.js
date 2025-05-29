import mongoose from "mongoose";

const courseProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      ref: "User",
      required: true,
    },
    courseId: {
      type: String,
      ref: "Course",
      required: true,
    },
    complete: {
      type: Boolean,
      default: false,
    },
    lecturecompleted: [],
  },
  { minimize: false }
);
 const CourseProgress = mongoose.model(
  "CourseProgress",
  courseProgressSchema
);

export default CourseProgress;