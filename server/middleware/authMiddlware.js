import { clerkClient, getAuth } from "@clerk/express";

// Middleware to check if the user is authenticated and has the 'educator' role
export const protectEducator = async (req, res, next) => {
  try {

    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        message: "Unauthorized - No valid session",
        success: false,
      });
    }

    const userId = auth.userId;
    const response = await clerkClient.users.getUser(userId);

    if (!response || !response.publicMetadata || response.publicMetadata.role !== "educator") {
      return res.status(403).json({
        message: "Forbidden - You do not have the required role",
        success: false,
      });
    }

    next();
    
  } catch (error) {
    console.error("Error in protectEducator middleware:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      success: false,
    });
  }
};
