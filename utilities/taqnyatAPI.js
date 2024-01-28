const axios = require("axios");

module.exports = {
  enableContacts: async (contacts) => {
    try {
      const config = {
        headers: {
          Authorization: "Bearer " + process.env.whatsapp_token,
          "Content-Type": "application/json",
        },
      };
      const data = {
        blocking: "wait",
        contacts: contacts,
        force_check: false,
      };
      const response = await axios.post(
        `${process.env.whatsapp_api_url}/contacts/`,
        data,
        config
      );
      return response.data;
    } catch (err) {
      throw new Error(err);
    }
  },
  sendMessage: async (phoneNumber, message, fileUrl) => {
    try {
      const config = {
        headers: {
          Authorization: "Bearer " + process.env.whatsapp_token,
          "Content-Type": "application/json",
        },
      };
      const data = {
        to: phoneNumber,
        type: "template",
        template: {
          name: "pdfandvariables",
          language: {
            code: "ar",
          },
        },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "document",
                document: {
                  link: fileUrl,
                  filename: "Invoice",
                },
              },
            ],
          },
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: message,
              },
              {
                type: "text",
                text: message,
              },
            ],
          },
        ],
      };
      const response = await axios.post(
        `${process.env.whatsapp_api_url}/messages/`,
        data,
        config
      );
      return response.data;
    } catch (err) {
      throw new Error(err);
    }
  },
};
