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
}

export interface CompletedRide {
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
      };
    }
  | { type: "CHECK_WEATHER" }
  | {
      type: "COMPLETE_RIDE";
      payload: {
        rideId: string;
        rideName: string;
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
};

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
      };

    case "CHECK_WEATHER": {
      if (
        state.weatherStartTime &&
        state.currentTime &&
        state.currentTime >= state.weatherStartTime &&
        !state.weatherActive
      ) {
        return { ...state, weatherActive: true };
      }
      if (
        state.weatherActive &&
        state.weatherClearTime &&
        state.currentTime &&
        state.currentTime >= state.weatherClearTime
      ) {
        return {
          ...state,
          weatherActive: false,
          weatherStartTime: null,
          weatherClearTime: null,
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
        ...action.payload,
        timeStarted: state.currentTime!,
        timeFinished: newTime,
        park: state.selectedParks[state.currentParkIndex],
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
      return {
        ...state,
        currentTime: newTime,
        selectedParks: [...state.selectedParks, action.payload.targetPark],
        currentParkIndex: state.currentParkIndex + 1,
      };
    }

    default:
      return state;
  }
}
