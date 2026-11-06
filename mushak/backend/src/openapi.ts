export const openapiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Mushak API",
    version: "0.0.0",
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "OK",
          },
        },
      },
    },
  },
};
