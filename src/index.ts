import express from "express";
import "dotenv/config";
import axios from "axios";
import { createServer } from "http";

const port = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// https://discord.com/developers/docs/resources/channel#message-object-message-flags
const SUPPRESS_NOTIFICATIONS = 1 << 12;

const assets = {
	now: {
		emote: null,
		image: "https://cdn.discordapp.com/emojis/1235233686471970877.webp?size=240&quality=lossless",
	},
	now_dev: {
		emote: null,
		image: "https://cdn.discordapp.com/emojis/1235233685209485312.webp?size=240&quality=lossless",
	},
	today: {
		emote: null,
		image: "https://cdn.discordapp.com/emojis/1235233689512710284.webp?size=240&quality=lossless",
	},
	today_dev: {
		emote: null,
		image: "https://cdn.discordapp.com/emojis/1235233687881125929.webp?size=240&quality=lossless",
	},
};

const sendDiscordNotification = async (
	embed: any,
	isSilent: boolean = false
) => {
	try {
		const response = await axios.post(
			`${process.env.DISCORD_WEBHOOK_URL}?wait=true`,
			{
				embeds: [embed],
				flags: isSilent ? SUPPRESS_NOTIFICATIONS : undefined,
			}
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

const getDiscordEmbed = (
	app: string,
	title: string,
	description: string | undefined,
	footer: string,
	url: string,
	type: "success" | "failure"
) => {
	return {
		author: {
			name: app,
			icon_url: getPropertyForApp(app, assets)?.image,
		},
		title,
		description,
		url,
		color: type == "success" ? 0x34c759 : 0xff3b30,
		footer: { text: footer },
	};
};

function getPropertyForApp<T>(appName: string, object: Record<string, T>) {
	const property = appName.toLowerCase().replaceAll(/-/g, "_");
	return object[property];
}

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
	const buildURL = `https://appstoreconnect.apple.com/teams/${process.env.XCODE_CLOUD_TEAM_ID}/apps/${app.id}/ci/builds/${buildId}/summary`;

	if (completionStatus !== "SUCCEEDED") {
		console.log("Build failed");
		const embed = getDiscordEmbed(
			appName,
			"❌ Build failed",
			undefined,
			`Build ${buildNumber}`,
			buildURL,
			"failure"
		);
		const sent = await sendDiscordNotification(embed);
		return res.status(sent ? 200 : 500).send("Notification sent");
	}

	const embed = getDiscordEmbed(
		appName,
		"✅ Build succeeded",
		undefined,
		`Build ${buildNumber}`,
		buildURL,
		"success"
	);
	const sent = await sendDiscordNotification(embed, true);
	return res.status(sent ? 200 : 500).send("Notification sent");
});

const server = createServer(app);
server.listen(port, () => {
	console.log(`App listening on port ${port}`);
});
