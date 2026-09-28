import axios from "axios";

const JALPI_API_URL =
    "https://app.jalpi.com/api/v1/getwabamedia";

export const downloadWhatsAppMedia = async (mediaId) => {
    try {

        const response = await axios.get(JALPI_API_URL, {
            params: {
                key: process.env.JALPI_API_KEY,
                mediaid: mediaId
            },
            responseType: "arraybuffer"
        });

        return response.data;

    } catch (error) {

        console.error(
            "JALPI Media Download Error:",
            error.response?.data || error.message
        );

        throw error;
    }
};


const JALPI_SEND_MESSAGE_URL =
    "https://app.jalpi.com/api/v1/SendUserInitiatedmsg";

export const sendWhatsAppMessage = async (phone, message) => {
    try {
        const response = await axios.post(
            JALPI_SEND_MESSAGE_URL,
            {
                key: process.env.JALPI_API_KEY,
                to: phone,
                type: "text",
                text: {
                    preview_url: "false",
                    body: message
                }
            },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("JALPI response:");
        console.log(response.data);

        return response.data;

    } catch (error) {
        console.error(
            "JALPI Send Message Error:",
            error.response?.data || error.message
        );

        throw error;
    }
};