import mongoose from 'mongoose';

const { Schema } = mongoose;

const presenceSchema = new Schema(
  {
    meetingId: {
      type: String,
      required: [true, 'Meeting ID is required'],
      trim: true,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    socketId: {
      type: String,
      required: [true, 'Socket ID is required'],
      trim: true,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Anonymous',
    },

    avatar: {
      type: String,
      trim: true,
      default: '',
    },

    handRaised: {
      type: Boolean,
      default: false,
    },

    // GeoJSON location for virtual office positioning
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },

      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(value) {
            return (
              Array.isArray(value) &&
              value.length === 2 &&
              Number.isFinite(value[0]) &&
              Number.isFinite(value[1]) &&
              value[0] >= -180 &&
              value[0] <= 180 &&
              value[1] >= -90 &&
              value[1] <= 90
            );
          },
          message: 'Coordinates must be valid [longitude, latitude]',
        },
      },
    },

    // Virtual office canvas coordinates (0–100)
    x: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },

    y: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },

    // Connection status
    isOnline: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Last activity timestamp
    lastSeen: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
  }
);

// Automatically update activity timestamp
presenceSchema.pre('save', function () {
  this.updatedAt = new Date();
  this.lastSeen = new Date();
});

// Prevent duplicate presence for the same user in a meeting
presenceSchema.index(
  { meetingId: 1, userId: 1 },
  { unique: true }
);

// Fast meeting participant lookup
presenceSchema.index({
  meetingId: 1,
  isOnline: 1,
});

// GeoJSON spatial queries
presenceSchema.index({
  location: '2dsphere',
});

// Socket lookup
presenceSchema.index({
  socketId: 1,
});

const Presence =
  mongoose.models.Presence ||
  mongoose.model('Presence', presenceSchema);

export default Presence;
