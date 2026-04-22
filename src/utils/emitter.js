import EventEmitter from 'events';

// Create a global event emitter to handle real-time broadcasts within the server instance
class QuizEmitter extends EventEmitter {}

export const quizEmitter = new QuizEmitter();

// Constants for event names
export const EVENTS = {
    LEADERBOARD_UPDATE: 'LEADERBOARD_UPDATE'
};
