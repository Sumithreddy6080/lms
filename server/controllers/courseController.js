import Course from "../models/Course.js";


// Function to get all courses
export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find({isPublished:true}).select(['-courseContent', '-enrolledStudents']).populate({path:'educator'});

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

//get course by id
export const getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Course.findById(courseId).populate({path:'educator'});

    //remove lecture url if ispreviewfree is false
    course.courseContent.forEach((chapter) => {
        chapter.chapterContent.forEach((lecture) => {
        if (!lecture.isPreviewFree) {
          lecture.lectureUrl = ""; 
        }
        })
    });

    res.json({
      message: "Course retrieved successfully",
      course,
      success: true,
    });
  } catch (error) {
    console.error("Error retrieving course:", error);
    res.status(500).json({
      message: "Error retrieving course",
      error: error.message,
      success: false,
    });
  }
};
