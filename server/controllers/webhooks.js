import { Webhook } from "svix";
import User from "../models/User.js";
import Stripe from "stripe";
import Purchase from "../models/Purchase.js";
import Course from "../models/Course.js";

export const clerkWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

    console.log("Received Clerk webhook with headers:", req.headers);

    await webhook.verify(JSON.stringify(req.body), {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
    console.log("Webhook signature verified successfully");

    const { data, type } = req.body;
    console.log("Received Clerk webhook of type:", type);
    console.log("Webhook data:", data);

    console.log("Processing Clerk webhook...");

    switch (type) {
      case "user.created": {
        // Validate required data
        if (!data.id || !data.email_addresses?.length) {
          return res.status(400).json({
            message: "Missing required user data",
            success: false,
          });
        }

        const userData = {
          _id: data.id,
          name:
            `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
            "Unknown User",
          email: data.email_addresses[0].email_address,
          imageUrl: data.image_url || null,
        };

        await User.create(userData);

        return res.status(200).json({
          message: "User created successfully",
          user: userData,
          success: true,
        });
      }

      case "user.updated": {
        // Validate required data
        if (!data.id || !data.email_addresses?.length) {
          return res.status(400).json({
            message: "Missing required user data",
            success: false,
          });
        }

        const userData = {
          name:
            `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
            "Unknown User",
          email: data.email_addresses[0].email_address,
          imageUrl: data.image_url || null,
        };

        const updatedUser = await User.findByIdAndUpdate(data.id, userData, {
          new: true,
        });

        if (!updatedUser) {
          return res.status(404).json({
            message: "User not found",
            success: false,
          });
        }

        return res.status(200).json({
          message: "User updated successfully",
          user: userData,
          success: true,
        });
      }

      case "user.deleted": {
        if (!data.id) {
          return res.status(400).json({
            message: "Missing user ID",
            success: false,
          });
        }

        const deletedUser = await User.findByIdAndDelete(data.id);

        if (!deletedUser) {
          return res.status(404).json({
            message: "User not found",
            success: false,
          });
        }

        return res.status(200).json({
          message: "User deleted successfully",
          success: true,
        });
      }

      default:
        console.log("Unhandled event type:", type);
        return res.status(200).json({
          message: "Event type not handled",
          success: true,
        });
    }
  } catch (error) {
    console.error("Error processing webhook:", error.message);

    // Return appropriate status code based on error type
    const statusCode = error.name === "ValidationError" ? 400 : 500;

    return res.status(statusCode).json({
      message: "Error processing webhook",
      error: error.message,
      success: false,
    });
  }
};

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhooks = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  console.log("Received Stripe webhook with signature:", sig);

  let event;

  try {
    event = Stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      console.log("PaymentIntent was successful!");

      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      const session = await stripeInstance.checkout.sessions.list({
        payment_intent: paymentIntentId,
      });
      const { purchaseId } = session.data[0].metadata;

      const purchaseData = await Purchase.findById(purchaseId);
      const userData = await User.findById(purchaseData.userId);
      const courseData = await Course.findById(
        purchaseData.courseId.toString()
      );

      courseData.enrolledStudents.push(userData);
      await courseData.save();

      userData.enrolledCourses.push(courseData._id);
      await userData.save();

      purchaseData.status = "completed";
      await purchaseData.save();
      console.log("Purchase completed successfully! and status updated");

      break;
    }

    case "payment_intent.payment_failed": {
      console.log("PaymentIntent failed!");
      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      const session = await stripeInstance.checkout.sessions.list({
        payment_intent: paymentIntentId,
      });
      const { purchaseId } = session.data[0].metadata;

      const purchaseData = await Purchase.findById(purchaseId);

      purchaseData.status = "failed";
      await purchaseData.save();
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
};
