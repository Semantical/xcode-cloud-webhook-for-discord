import express from "express";
import "dotenv/config";
import axios from "axios";
import { createServer } from "http";

const port = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sendDiscordNotification = async (content: String, embeds: any) => {
	try {
		const response = await axios.post(
			`${process.env.DISCORD_WEBHOOK_URL}?wait=true`,
			{ content, embeds }
		);
		console.log("Discord response:", response.status, response.statusText);
		if (response.status !== 200) {
			throw new Error(
				`Failed to send Discord notification: ${response.status} ${response.statusText}`
			);
		}
	} catch (error) {
		console.error("Error sending Discord notification:", error);
		return false;
	}
	return true;
};

app.post("/", async (req, res) => {
	console.log("Environment Variables", {
		TeamID: process.env.XCODE_CLOUD_TEAM_ID,
		DiscordURL: process.env.DISCORD_WEBHOOK_URL,
	});

	const { ciBuildRun, ciProduct, app } = req.body;
	if (!ciBuildRun || !ciProduct || !app) {
		console.log("Required data missing in request");
		return res.status(400).send("Required data missing");
	}

	const { attributes, id: buildId } = ciBuildRun;
	if (!attributes || !buildId) {
		console.log("Build details are incomplete");
		return res.status(400).send("Build details are incomplete");
	}

	const {
		executionProgress,
		number: buildNumber,
		completionStatus,
	} = attributes;
	console.log(`Build execution progress: ${executionProgress}`);
	if (executionProgress !== "COMPLETE") {
		return res.status(200).send("Build not complete");
	}

	const appName = ciProduct?.attributes?.name ?? "-";

	if (completionStatus !== "SUCCEEDED") {
		console.log("Build failed");
		const sent = await sendDiscordNotification("❌ Build failed", [
			{
				title: `${appName || "-"} | Build ${buildNumber || ""}`,
				url: `https://appstoreconnect.apple.com/teams/${process.env.XCODE_CLOUD_TEAM_ID}/apps/${app.id}/ci/builds/${buildId}/summary`,
			},
		]);
		return res.status(sent ? 200 : 500).send("Notification sent");
	}

	const sent = await sendDiscordNotification("Build completed! ⛏️", [
		{
			title: `${appName} (TestFlight)`,
			url: `itms-beta://beta.itunes.apple.com/v1/app/${app.id}`,
		},
	]);
	return res.status(sent ? 200 : 500).send("Notification sent");
});

const server = createServer(app);
server.listen(port, () => {
	console.log(`App listening on port ${port}`);
});
