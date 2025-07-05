
const { SpeechClient } = require('@google-cloud/speech');

// IMPORTANT: This function will run on Vercel's backend, not in the browser.
// Your Google Cloud credentials need to be set as environment variables in Vercel.
const speechClient = new SpeechClient();

module.exports = async (req, res) => {
    // 1. We only accept POST requests.
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        // 2. Get the audio data from the request body.
        // The audio data is sent as a base64 encoded string.
        const audioBytes = req.body.audio;
        if (!audioBytes) {
            res.status(400).send('Bad Request: Missing audio data.');
            return;
        }

        const audio = {
            content: audioBytes,
        };
        const config = {
            encoding: 'WEBM_OPUS', // This needs to match the format from the browser
            sampleRateHertz: 48000, // This needs to match the format from the browser
            languageCode: 'en-US',
            model: 'default', // or 'telephony', 'medical_dictation', etc. depending on your use case
        };
        const request = {
            audio: audio,
            config: config,
        };

        // 3. Send the request to Google Cloud Speech-to-Text API
        const [response] = await speechClient.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        // 4. Send the transcription result back to the browser.
        res.status(200).json({ transcription });

    } catch (error) {
        console.error('ERROR:', error);
        res.status(500).send('Internal Server Error');
    }
};
