import { Router } from 'express';
import crypto from 'crypto';
import Meeting from '../models/Meeting.js';

const router = Router();

const VALID_ROOM_TYPES = ['voice', 'meeting', 'lounge', 'conference'];

/**
 * Generate a readable and secure meeting ID.
 * Example: PS-A1B2C3-D4E5F6
 */
const makeId = () => {
  const first = crypto.randomBytes(3).toString('hex').toUpperCase();
  const second = crypto.randomBytes(3).toString('hex').toUpperCase();

  return `PS-${first}-${second}`;
};

/**
 * CREATE MEETING
 * POST /api/meetings
 */
router.post('/', async (req, res) => {
  try {
    const title = String(req.body.title || 'Team Meeting')
      .trim()
      .slice(0, 100);

    const roomType = VALID_ROOM_TYPES.includes(req.body.roomType)
      ? req.body.roomType
      : 'meeting';

    // Create a unique meeting ID
    let meetingId;
    let exists = true;

    while (exists) {
      meetingId = makeId();
      exists = await Meeting.exists({ meetingId });
    }

    const meeting = await Meeting.create({
      meetingId,
      title,
      roomType,
      host: req.user.id,
      isActive: true
    });

    return res.status(201).json({
      success: true,
      message: 'Meeting created successfully.',
      meeting
    });
  } catch (error) {
    console.error('Create meeting error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to create meeting.'
    });
  }
});

/**
 * GET MEETING DETAILS
 * GET /api/meetings/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const meetingId = String(req.params.id).trim().toUpperCase();

    const meeting = await Meeting.findOne({
      meetingId,
      isActive: true
    }).populate('host', 'name avatar');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or has already ended.'
      });
    }

    return res.json({
      success: true,
      meeting: {
        meetingId: meeting.meetingId,
        title: meeting.title,
        roomType: meeting.roomType,
        host: meeting.host,
        isActive: meeting.isActive,
        createdAt: meeting.createdAt
      }
    });
  } catch (error) {
    console.error('Get meeting error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to get meeting details.'
    });
  }
});

/**
 * END MEETING
 * POST /api/meetings/:id/end
 */
router.post('/:id/end', async (req, res) => {
  try {
    const meetingId = String(req.params.id).trim().toUpperCase();

    const meeting = await Meeting.findOne({
      meetingId,
      host: req.user.id
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or you are not the host.'
      });
    }

    if (!meeting.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This meeting has already ended.'
      });
    }

    meeting.isActive = false;
    await meeting.save();

    // Notify all participants through Socket.IO
    const io = req.app.get('io');

    if (io) {
      io.to(meetingId).emit('meeting:ended', {
        meetingId,
        message: 'The host has ended the meeting.'
      });
    }

    return res.json({
      success: true,
      message: 'Meeting ended successfully.'
    });
  } catch (error) {
    console.error('End meeting error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to end the meeting.'
    });
  }
});

export default router;
