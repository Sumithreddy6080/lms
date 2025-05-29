import express from 'express';
import { getAllCourses, getCourseById } from '../controllers/courseController.js';

const courserRouter = express.Router();


courserRouter.get('/all',getAllCourses);
courserRouter.get('/:id',getCourseById);

export default courserRouter;