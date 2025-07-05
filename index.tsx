import React from "react";
// 修正: GoogleGenerativeAIのimport方法を変更
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactDOM from "react-dom/client";

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

// Note: This key needs to be exposed by your build tool (e.g., Webpack, Vite).
// For Create React App, you would name it REACT_APP_API_KEY in a .env file.
// For Vite, you would name it VITE_API_KEY in a .env file.
const apiKey = process.env.REACT_APP_API_KEY;

const PRACTICE_ITEMS = [
    { type: 'pair', wordS: 'sea', ipaS: '/siː/', wordSh: 'she', ipaSh: '/ʃiː/', translation: '海 / 彼女' },
    { type: 'pair', wordS: 'seat', ipaS: '/siːt/', wordSh: 'sheet', ipaSh: '/ʃiːt/', translation: '席 / シーツ' },
    { type: 'pair', wordS: 'sell', ipaS: '/sel/', wordSh: 'shell', ipaSh: '/ʃel/', translation: '売る / 貝殻' },
    { type: 'pair', wordS: 'self', ipaS: '/self/', wordSh: 'shelf', ipaSh: '/ʃelf/', translation: '自己 / 棚' },
    { type: 'sentence', text: 'She sells seashells by the seashore.', ipa: '/ʃiː selz ˈsiːʃelz baɪ ðə ˈsiːʃɔːr/', translation: '彼女は海岸で貝殻を売る' },
];


const MicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
    </svg>
);

const CrossIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
);

// Speech Recognition wrapper
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const recognizeSpeech = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!SpeechRecognition) {
            reject("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            resolve(transcript);
        };

        recognition.onerror = (event) => {
            reject(`Speech recognition error: ${event.error}`);
        };

        recognition.onend = () => {
            // Automatically ends after a period of silence.
        };

        recognition.start();
    });
};

type Feedback = {
    isCorrect: boolean;
    feedback: string;
    tip: string;
};

const App = () => {
    const [currentItemIndex, setCurrentItemIndex] = React.useState(0);
    const [status, setStatus] = React.useState<'idle' | 'recording' | 'analyzing' | 'result'>('idle');
    const [activeWord, setActiveWord] = React.useState<string | null>(null);
    const [feedback, setFeedback] = React.useState<Feedback | null>(null);
    const [error, setError] = React.useState('');

    const ai = React.useMemo(() => apiKey ? new GoogleGenerativeAI(apiKey) : null, []);

    const analyzePronunciation = async (targetWord: string, targetIpa: string, transcript: string) => {
        if (!ai) {
            setError("API key is not configured.");
            setStatus('idle');
            return;
        }
        setStatus('analyzing');
        setError('');
        setFeedback(null);

        const prompt = `You are an expert English pronunciation coach for native Japanese speakers.\nA user was asked to say: "${targetWord}" (IPA: ${targetIpa}).\nSpeech recognition transcribed their attempt as: "${transcript}".\n\nAnalyze this. Respond ONLY with a JSON object in this format:\n{\n  "isCorrect": boolean,\n  "feedback": "A short, encouraging message about the pronunciation. Example: 'Good try! It sounded like 'ship' instead of 'sip'."",\n  "tip": "A concrete tip focusing on tongue/lip placement for /s/ vs /ʃ/. Contrast with Japanese sounds if helpful. If correct, give a general encouragement tip."
}`;

        try {
            const model = ai.getGenerativeModel({ model: "gemini-pro", generationConfig: { responseMimeType: "application/json" } });
            const result = await model.generateContent(prompt);
            const response = result.response;
            let jsonStr = response.text();

            // The model might wrap the JSON in a markdown code block.
            const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[1]) {
              jsonStr = match[1].trim();
            }

            const feedbackResult: Feedback = JSON.parse(jsonStr);
            setFeedback(feedbackResult);
            setStatus('result');
        } catch (e) {
            console.error(e);
            setError("Couldn't get feedback from AI. Please try again.");
            setStatus('idle');
        }
    };

    const handleRecord = async (word: string, ipa: string) => {
        setActiveWord(word);
        setStatus('recording');
        setError('');
        setFeedback(null);

        try {
            const transcript = await recognizeSpeech();
            await analyzePronunciation(word, ipa, transcript);
        } catch (err) {
            console.error(err);
            setError(String(err));
            setStatus('idle');
        }
    };

    const handleNextItem = () => {
        setCurrentItemIndex((prevIndex) => (prevIndex + 1) % PRACTICE_ITEMS.length);
        setStatus('idle');
        setFeedback(null);
        setError('');
        setActiveWord(null);
    };
    
    const currentItem = PRACTICE_ITEMS[currentItemIndex];
    const isAnalyzingOrRecording = status === 'analyzing' || status === 'recording';

    return (
        <div className="main-container">
            <header className="header">
                <h1 className="app-title">S/SH Pronunciation Coach</h1>
                <p className="app-subtitle">Practice your /s/ and /ʃ/ sounds</p>
            </header>

            <main className="coach-card">
                {currentItem.type === 'pair' ? (
                    <>
                        <div className="pair-container">
                            <div className="word-card">
                                <h2 className="word">{currentItem.wordS ?? ""}</h2>
                                <p className="ipa">{currentItem.ipaS}</p>
                                <button
                                    className={`record-btn ${status === 'recording' && activeWord === currentItem.wordS ? 'recording' : ''}`}
                                    onClick={() => handleRecord(currentItem.wordS!, currentItem.ipaS!)}
                                    disabled={isAnalyzingOrRecording}
                                    aria-label={`Record pronunciation for ${currentItem.wordS}`}
                                >
                                   <MicIcon />
                                </button>
                            </div>
                            <div className="word-card">
                                <h2 className="word">{currentItem.wordSh}</h2>
                                <p className="ipa">{currentItem.ipaSh}</p>
                                <button
                                    className={`record-btn ${status === 'recording' && activeWord === currentItem.wordSh ? 'recording' : ''}`}
                                    onClick={() => handleRecord(currentItem.wordSh!, currentItem.ipaSh!)}
                                    disabled={isAnalyzingOrRecording}
                                    aria-label={`Record pronunciation for ${currentItem.wordSh}`}
                                >
                                    <MicIcon />
                                </button>
                            </div>
                        </div>
                        <p className="translation">{currentItem.translation}</p>
                    </>
                ) : (
                    <>
                        <div className="sentence-container">
                            <div className="sentence-card">
                                <p className="sentence-text">{currentItem.text}</p>
                                <p className="ipa">{currentItem.ipa}</p>
                                <button
                                    className={`record-btn ${status === 'recording' && activeWord === currentItem.text ? 'recording' : ''}`}
                                    onClick={() => handleRecord(currentItem.text!, currentItem.ipa!)}
                                    disabled={isAnalyzingOrRecording}
                                    aria-label={`Record pronunciation for the sentence`}
                                >
                                    <MicIcon />
                                </button>
                            </div>
                        </div>
                        <p className="translation">{currentItem.translation}</p>
                    </>
                )}
                {/* Removed undefined SomeComponent */}


                <div className={`feedback-container ${status === 'result' ? `result ${feedback?.isCorrect ? 'correct' : 'incorrect'}` : ''}`} aria-live="polite">
                    {status === 'idle' && <p>Press a mic to start recording.</p>}
                    {status === 'recording' && <p>Listening...</p>}
                    {status === 'analyzing' && <div className="loader" aria-label="Analyzing pronunciation"></div>}
                    {status === 'result' && feedback && (
                        <>
                            <div className={`feedback-header ${feedback.isCorrect ? 'correct' : 'incorrect'}`}>
                                {feedback.isCorrect ? <CheckIcon/> : <CrossIcon/>}
                                <span>{feedback.isCorrect ? "Excellent!" : "Needs Practice"}</span>
                            </div>
                            <p className="feedback-text">{feedback.feedback}</p>
                            <p className="feedback-text feedback-tip">{feedback.tip}</p>
                        </>
                    )}
                </div>

                <button className="next-pair-btn" onClick={handleNextItem}>
                    Next Item &rarr;
                </button>
                {error && <p className="error-message">{error}</p>}
                {!apiKey && 
                    <p className="error-message">
                        Warning: API key not found. AI analysis is disabled. Please ensure the API_KEY is set in your environment and exposed to the browser (e.g., as REACT_APP_API_KEY or VITE_API_KEY).
                    </p>
                }
            </main>
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
}