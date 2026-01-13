
export type EyeExpression = 
  | 'neutral' 
  | 'happy'     // 喜
  | 'angry'     // 怒
  | 'sad'       // 哀
  | 'joyful'    // 乐
  | 'surprised' // 惊
  | 'blink' 
  | 'slit' 
  | 'wide' 
  | 'smile' 
  | 'tiny' 
  | 'love'
  | 'thinking';

export interface LookTarget {
  x: number; // -1 to 1
  y: number; // -1 to 1
}

export interface AppState {
  expressionLeft: EyeExpression;
  expressionRight: EyeExpression;
  isRecording: boolean;
  isConnected: boolean;
  isAnalyzing: boolean;
  transcription: string;
}