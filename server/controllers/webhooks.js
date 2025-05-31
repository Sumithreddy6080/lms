// Fixed webhook controller
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

    // Fix: Pass raw body directly, not JSON.stringify
    await webhook.verify(req.body, {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
    console.log("Webhook signature verified successfully");

    // Parse the body after verification
    const payload = JSON.parse(req.body);
    const { data, type } = payload;
    
    console.log("Received Clerk webhook of type:", type);
    console.log("Webhook data:", data);

    switch (type) {
      case "user.created": {
        if (!data.id || !data.email_addresses?.length) {
          return res.status(400).json({
            message: "Missing required user data",
            success: false,
          });
        }

        const userData = {
          _id: data.id,
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || "Unknown User",
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
        if (!data.id || !data.email_addresses?.length) {
          return res.status(400).json({
            message: "Missing required user data",
            success: false,
          });
        }

        const userData = {
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || "Unknown User",
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
    console.error("Error processing Clerk webhook:", error.message);
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
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded": {
        console.log("PaymentIntent was successful!");

        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id;

        const session = await stripeInstance.checkout.sessions.list({
          payment_intent: paymentIntentId,
        });
        
        if (!session.data.length) {
          console.error("No session found for payment intent:", paymentIntentId);
          break;
        }

        const { purchaseId } = session.data[0].metadata;
        
        if (!purchaseId) {
          console.error("No purchaseId in session metadata");
          break;
        }

        const purchaseData = await Purchase.findById(purchaseId);
        if (!purchaseData) {
          console.error("Purchase not found:", purchaseId);
          break;
        }

        const userData = await User.findById(purchaseData.userId);
        const courseData = await Course.findById(purchaseData.courseId.toString());

        if (!userData || !courseData) {
          console.error("User or Course not found");
          break;
        }

        // Update course and user
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
        
        if (session.data.length) {
          const { purchaseId } = session.data[0].metadata;
          if (purchaseId) {
            const purchaseData = await Purchase.findById(purchaseId);
            if (purchaseData) {
              purchaseData.status = "failed";
              await purchaseData.save();
            }
          }
        }
        break; // Fix: Added missing break
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error("Error processing Stripe webhook:", error.message);
    return res.status(500).json({
      message: "Error processing webhook",
      error: error.message,
      success: false,
    });
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
};