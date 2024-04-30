import express from "express";
import "dotenv/config";
import axios from "axios";
import { createServer } from "http";

const port = 3000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/", async (req, res) => {
	const data = req.body;
	const ciBuildRun = data.ciBuildRun;
	if (!ciBuildRun) {
		console.log("ciBuildRun not found");
		res.sendStatus(200);
		return;
	}

	const ciBuildRunAttributes = ciBuildRun.attributes;
	if (!ciBuildRunAttributes) {
		console.log("ciBuildRun.attributes not found");
		res.sendStatus(200);
		return;
	}

	const executionProgress = ciBuildRunAttributes.executionProgress;
	console.log(`Build execution progress: ${executionProgress}`);
	if (executionProgress !== "COMPLETE") {
		res.sendStatus(200);
		return;
	}

	const appId = data.app.id;
	if (!appId) {
		console.log("App ID not found");
		res.sendStatus(200);
		return;
	}

	const buildNumber = ciBuildRunAttributes.number;
	const buildId = ciBuildRun.id;
	const appName = data.ciProduct?.attributes?.name ?? "-";

	if (!buildId) {
		console.log("Build ID not found");
		res.sendStatus(200);
		return;
	}

	const buildEmbeds = [
		{
			title: `${appName} | Build ${buildNumber ?? ""}`,
			url: `https://appstoreconnect.apple.com/teams/${process.env.XCODE_CLOUD_TEAM_ID}/apps/${appId}/ci/builds/${buildId}/summary`,
		},
	];

	const completionStatus = ciBuildRunAttributes.completionStatus;
	if (completionStatus !== "SUCCEEDED") {
		console.log("Build failed");
		const discordResponse = await axios.post(
			`${process.env.DISCORD_WEBHOOK_URL}?wait=true`,
			{
				content: "❌ Build failed",
				embeds: buildEmbeds,
			}
		);
		if (discordResponse.status !== 200) {
			console.log("Failed to send message");
		}
		res.sendStatus(200);
		return;
	}

	const discordResponse = await axios.post(
		`${process.env.DISCORD_WEBHOOK_URL}?wait=true`,
		{
			content: "Build completed! ⛏️",
			embeds: [
				{
					title: `TestFlight | ${appName}`,
					url: `itms-beta://beta.itunes.apple.com/v1/app/${appId}`,
				},
			],
		}
	);

	if (discordResponse.status !== 200) {
		console.log("Failed to send message");
	}

	res.sendStatus(200);
});

const server = createServer(app);

server.listen(port, () => {
	console.log(`App listening on port ${port}`);
});
