export interface SimulationState {
  status: "setup" | "active" | "ended";
  selectedParks: string[];
  currentParkIndex: number;
  currentTime: Date | null;
  endTime: Date | null;
  completedRides: CompletedRide[];
  weatherActive: boolean;
  weatherStartTime: Date | null;
  weatherClearTime: Date | null;
  /** 0-100 chance used to roll follow-up storms after one clears. */
  weatherChance: number;
  totalTravelMinutes: number;
  weatherEventCount: number;
}

export interface CompletedRide {
  /** Distinguishes real attractions from breaks / exploring / shopping. */
  kind: "ride" | "action";
  rideId: string;
  rideName: string;
  parkArea?: string;
  waitTime: number;
  onRideTime: number;
  walkingTime: number;
  timeStarted: Date;
  timeFinished: Date;
  park: string;
  visitIndex: number;
}

export type SimulationAction =
  | {
      type: "START_SIMULATION";
      payload: {
        selectedParks: string[];
        startTime: Date;
        endTime: Date;
        weatherStartTime: Date | null;
        weatherClearTime: Date | null;
        weatherChance: number;
      };
    }
  | { type: "RESET_SIMULATION" }
  | { type: "CHECK_WEATHER" }
  | {
      type: "COMPLETE_RIDE";
      payload: {
        kind?: "ride" | "action";
        rideId: string;
        rideName: string;
        parkArea?: string;
        waitTime: number;
        onRideTime: number;
        walkingTime: number;
      };
    }
  | { type: "TAKE_BREAK"; payload: { minutes: number } }
  | { type: "PARK_HOP"; payload: { travelTime: number; targetPark: string } };

export const initialSimulationState: SimulationState = {
  status: "setup",
  selectedParks: [],
  currentParkIndex: 0,
  currentTime: null,
  endTime: null,
  completedRides: [],
  weatherActive: false,
  weatherStartTime: null,
  weatherClearTime: null,
  weatherChance: 0,
  totalTravelMinutes: 0,
  weatherEventCount: 0,
};

/** Roll a possible follow-up storm somewhere between `from` and the end of the day. */
function scheduleNextStorm(
  from: Date,
  endTime: Date | null,
  chance: number,
): { start: Date | null; clear: Date | null } {
  if (!endTime || chance <= 0) return { start: null, clear: null };
  const remainingMinutes = Math.floor((endTime.getTime() - from.getTime()) / 60000);
  // Need enough runway left for another storm to matter.
  if (remainingMinutes < 60) return { start: null, clear: null };
  if (Math.random() * 100 >= chance) return { start: null, clear: null };
  const start = new Date(from.getTime() + (15 + Math.floor(Math.random() * (remainingMinutes - 45))) * 60000);
  const clear = new Date(start.getTime() + (45 + Math.floor(Math.random() * 120)) * 60000);
  return { start, clear };
}

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction
): SimulationState {
  switch (action.type) {
    case "START_SIMULATION":
      return {
        status: "active",
        selectedParks: action.payload.selectedParks,
        currentParkIndex: 0,
        currentTime: action.payload.startTime,
        endTime: action.payload.endTime,
        completedRides: [],
        weatherActive: false,
        weatherStartTime: action.payload.weatherStartTime,
        weatherClearTime: action.payload.weatherClearTime,
        weatherChance: action.payload.weatherChance,
        totalTravelMinutes: 0,
        weatherEventCount: 0,
      };

    case "RESET_SIMULATION":
      return { ...initialSimulationState };

    case "CHECK_WEATHER": {
      if (
        state.weatherStartTime &&
        state.currentTime &&
        state.currentTime >= state.weatherStartTime &&
        !state.weatherActive
      ) {
        return { ...state, weatherActive: true, weatherEventCount: state.weatherEventCount + 1 };
      }
      if (
        state.weatherActive &&
        state.weatherClearTime &&
        state.currentTime &&
        state.currentTime >= state.weatherClearTime
      ) {
        // Storms can repeat — roll for the next one in the remaining window.
        const next = scheduleNextStorm(state.currentTime, state.endTime, state.weatherChance);
        return {
          ...state,
          weatherActive: false,
          weatherStartTime: next.start,
          weatherClearTime: next.clear,
        };
      }
      return state;
    }

    case "COMPLETE_RIDE": {
      const newTime = new Date(state.currentTime!);
      newTime.setMinutes(
        newTime.getMinutes() +
          action.payload.waitTime +
          action.payload.onRideTime +
          action.payload.walkingTime
      );
      const rideEntry: CompletedRide = {
        kind: action.payload.kind ?? "ride",
        rideId: action.payload.rideId,
        rideName: action.payload.rideName,
        parkArea: action.payload.parkArea,
        waitTime: action.payload.waitTime,
        onRideTime: action.payload.onRideTime,
        walkingTime: action.payload.walkingTime,
        timeStarted: state.currentTime!,
        timeFinished: newTime,
        park: state.selectedParks[state.currentParkIndex],
        visitIndex: state.currentParkIndex,
      };
      return {
        ...state,
        currentTime: newTime,
        completedRides: [...state.completedRides, rideEntry],
        status: newTime >= state.endTime! ? "ended" : state.status,
      };
    }

    case "TAKE_BREAK": {
      const newTime = new Date(state.currentTime!);
      newTime.setMinutes(newTime.getMinutes() + action.payload.minutes);
      return {
        ...state,
        currentTime: newTime,
        status: newTime >= state.endTime! ? "ended" : state.status,
      };
    }

    case "PARK_HOP": {
      const newTime = new Date(state.currentTime!);
      newTime.setMinutes(newTime.getMinutes() + action.payload.travelTime);
      const ended = !!state.endTime && newTime >= state.endTime;
      return {
        ...state,
        currentTime: newTime,
        selectedParks: [...state.selectedParks, action.payload.targetPark],
        currentParkIndex: state.currentParkIndex + 1,
        totalTravelMinutes: state.totalTravelMinutes + action.payload.travelTime,
        status: ended ? "ended" : state.status,
      };
    }

    default:
      return state;
  }
}
