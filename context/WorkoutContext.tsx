import React, { createContext, useContext, useState, useEffect } from 'react';

type WorkoutContextType = {
  activeWorkout: {
    id: number | null;
    routineName: string;
    startTime: number | null;
    isActive: boolean;
  };
  startWorkout: (id: number, name: string) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  endWorkout: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState({
    id: null as number | null,
    routineName: '',
    startTime: null as number | null,
    isActive: false
  });
  
  // Start a new workout
  const startWorkout = (id: number, name: string) => {
    console.log("Starting workout in context:", id, name);
    setActiveWorkout({
      id,
      routineName: name,
      startTime: Date.now(),
      isActive: true // When starting a workout, it's active (showing on screen)
    });
  };

  // Pause the workout (when user minimizes it)
  const pauseWorkout = () => {
    console.log("Pausing workout in context");
    setActiveWorkout(prev => ({
      ...prev,
      isActive: false // When minimizing, set to inactive (showing indicator)
    }));
  };

  // Resume the workout (when user returns to it)
  const resumeWorkout = () => {
    console.log("Resuming workout in context");
    setActiveWorkout(prev => ({
      ...prev,
      isActive: true // When returning to workout screen, set active again
    }));
  };

  // End the workout (when user finishes it)
  const endWorkout = () => {
    console.log("Ending workout in context");
    setActiveWorkout({
      id: null,
      routineName: '',
      startTime: null,
      isActive: false
    });
  };

  return (
    <WorkoutContext.Provider value={{
      activeWorkout,
      startWorkout,
      pauseWorkout,
      resumeWorkout,
      endWorkout 
    }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (context === undefined) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
} 