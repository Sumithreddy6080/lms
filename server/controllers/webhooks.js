import { Webhook } from "svix";
import User from "../models/User.js";

export const clerkWebhook = async (req, res) => {
  try {
    const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

    await whook.verify(JSON.stringify(req.body), {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });

    const { data, type } = req.body;
    switch (type) {
      case "user.created": {
        const userData = {
          _id: data.id,
          name: data.first_name + " " + data.last_name,
          email: data.email_addresses[0].email_address,
          imageUrl: data.image_url,
        };

        await User.create(userData);
        res.json({
          message: "User created successfully",
          user: userData,
        });
        break;
      }
      case "user.updated": {
        const userData = {
          name: data.first_name + " " + data.last_name,
          email: data.email_addresses[0].email_address,
          imageUrl: data.image_url,
        };
        await User.findByIdAndUpdate(data.id, userData);
        res.json({
          message: "User updated successfully",
          user: userData,
        });
        break;
      }

      case "user.deleted": {
        await User.findByIdAndDelete(data.id);
        res.json({
          message: "User deleted successfully",
        });
        break;
      }

      default:
        console.log("Unhandled event type:", type);
    }
  } catch (error) {
    res.status(400).json({
      message: "Error processing webhook",
      error: error.message,
      success: false,
    });
  }
};
