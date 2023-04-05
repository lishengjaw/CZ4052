**Youtube Video Summarizer**

1. Clone the repository
2. Run the frontend
    1. `cd frontend`
    2. `npm start`
    3. Go to [link](http://localhost:3000)
3. Run the backend
    1. `cd backend`
    2. Create a .env file containing the following variables:
        1. `PORT`=3001
        2. `YOUTUBE_URL`=https://www.youtube.com/watch?v=
        3. `YOUTUBE_DATA_API_URL`=https://www.googleapis.com/youtube/v3/search
        4. `YOUTUBE_DATA_API_KEY`=< Refer to https://developers.google.com/youtube/v3/getting-started >
        5. `OPENAI_API_URL`=https://api.openai.com/v1/completions
        6. `OPENAI_API_KEY`=< Refer to https://platform.openai.com/account/api-keys >
    3. `npm start`
