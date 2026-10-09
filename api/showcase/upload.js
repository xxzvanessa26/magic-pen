const { handleUpload } = require("@vercel/blob/client");
const { getSessionFromRequest, isAdminSession } = require("../_lib/auth.js");

const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300MB

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const session = getSessionFromRequest(req);
  if (!isAdminSession(session)) {
    return res.status(403).json({ error: "forbidden", message: "Only the site owner can upload the showcase video." });
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async function () {
        return {
          allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
          addRandomSuffix: true,
          allowOverwrite: true,
          maximumSizeInBytes: MAX_VIDEO_BYTES
        };
      }
    });
    return res.status(200).json(jsonResponse);
  } catch (e) {
    console.error("[/api/showcase/upload]", e);
    return res.status(400).json({ error: "upload_failed", message: e.message || "Upload failed." });
  }
};
