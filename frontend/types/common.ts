// Common type definitions used across the application

// Custom type for synthetic events that mimic React's ChangeEvent
export type CustomChangeEvent = {
    target: {
        name: string;
        value: any;
    };
};

// Combined type for both native React events and our custom events
export type ChangeEventOrCustomEvent<T = HTMLElement> =
    | React.ChangeEvent<T>
    | CustomChangeEvent;
