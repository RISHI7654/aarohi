const { execSync } = require('child_process');
const fs = require('fs');

// Function to check and install required modules
const installModules = (module) => {
  try {
    // Check if the module exists
    require.resolve(module);
    console.log(`[✓] Module '${module}' is already installed.`);
  } catch (err) {
    // If the module is not found, install it
    console.log(`[+] Installing module '${module}'...`);
    execSync(`npm install ${module}`, { stdio: 'inherit' });
    console.log(`[✓] Module '${module}' installed successfully.`);
  }
};

// List of required modules
const requiredModules = ['@whiskeysockets/baileys', 'pino', 'readline'];

// Check and install each required module
for (const module of requiredModules) {
  installModules(module);
}

// Proceed with the rest of the script
(async () => {
  try {
    const { makeWASocket, useMultiFileAuthState, delay } = await import("@whiskeysockets/baileys");
    const pino = (await import('pino')).default;

    const rl = (await import("readline")).createInterface({ input: process.stdin, output: process.stdout });
    const question = (text) => new Promise((resolve) => rl.question(text, resolve));

    const reset = "\x1b[0m";
    const green = "\x1b[1;32m";
    const yellow = "\x1b[1;33m";

    const logo = `
 __    __ _           _                         
/ /\\ /\\ \\ |__   __ _| |_ ___  __ _ _ __  _ __  
\\ \\/  \\/ / '_ \\ / _\` | __/ __|/ _\` | '_ \\| '_ \\ 
 \\  /\\  /| | | | (_| | |\\__ \\ (_| | |_) | |_) |
  \\/  \\/ |_| |_|\\__,_|\\__|___/\\__,_| .__/| .__/ 
                                   |_|   |_|    
----------------------------------------------------------------
[~] Author  : Radhe
[~] GitHub  : radhe9828
[~] Tool  : Automatic WhatsApp Message Sender
----------------------------------------------------------------`;

    const clearScreen = () => {
      console.clear();
      console.log(logo);
    };

    let targetNumbers = [];
    let groupIDs = [];
    let messages = [];
    let intervalTime = null;
    let groupHaterName = null;
    let chatHaterName = null;

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // Function to connect to WhatsApp
    const connectToWhatsApp = async () => {
      const MznKing = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state, // Use the in-memory state
      });

      // Prompt for pairing code if not already defined
      if (!MznKing.authState.creds.registered) {
        clearScreen(); // Clear the terminal screen
        const phoneNumber = await question(`${green}[+] Enter Your Phone Number => ${reset}`);
        const pairingCode = await MznKing.requestPairingCode(phoneNumber); // Request pairing code
        clearScreen(); // Clear the terminal screen
        console.log(`${green}[√] Your Pairing Code Is => ${reset}${pairingCode}`);
      }

      // Connection updates
      MznKing.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection === "open") {
          clearScreen(); // Clear the terminal screen
          console.log(`${green}[Your WhatsApp Login ✓]${reset}`);
          await mainMenu(MznKing);
        }

        if (connection === "close") {
          const errorCode = lastDisconnect?.error?.output?.statusCode;

          if (errorCode === 403) {
            console.log(`${yellow}[•] Connection closed. Please log in again.${reset}`);
            rl.close();
          } else {
            console.log(`${yellow}[•] Connection lost. Reconnecting...${reset}`);
            connectToWhatsApp();
          }
        }
      });

      MznKing.ev.on("creds.update", saveCreds);
    };

    async function sendMessages(MznKing) {
      let messageIndex = 0;

      while (true) {
        for (let i = 0; i < Math.max(groupIDs.length, targetNumbers.length); i++) {
          // Send message to WhatsApp group
          if (i < groupIDs.length) {
            try {
              const currentTime = new Date().toLocaleTimeString();
              const message = `${groupHaterName} ${messages[messageIndex % messages.length]}`;
              const targetGroup = `${groupIDs[i]}@g.us`;

              await MznKing.sendMessage(targetGroup, { text: message });

              console.log(`${green}[•] WhatsApp Group ID => ${reset}${groupIDs[i]}`);
              console.log(`${green}[•] Time => ${reset}${currentTime}`);
              console.log(`${green}[•] Message => ${reset}${message}`);
              console.log(`${yellow}----------------------------------------------------------------${reset}`);

              messageIndex++;
              await delay(intervalTime * 1000);
            } catch (sendError) {
              console.log(`${yellow}Error sending message to Group ID ${groupIDs[i]}: ${sendError.message}. Retrying...${reset}`);
              await delay(5000);
            }
          }

          // Send message to target number
          if (i < targetNumbers.length) {
            try {
              const currentTime = new Date().toLocaleTimeString();
              const message = `${chatHaterName} ${messages[messageIndex % messages.length]}`;
              const target = `${targetNumbers[i]}@c.us`;

              await MznKing.sendMessage(target, { text: message });

              console.log(`${green}[•] Target Number => ${reset}${targetNumbers[i]}`);
              console.log(`${green}[•] Time => ${reset}${currentTime}`);
              console.log(`${green}[•] Message => ${reset}${message}`);
              console.log(`${yellow}----------------------------------------------------------------${reset}`);

              messageIndex++;
              await delay(intervalTime * 1000);
            } catch (sendError) {
              console.log(`${yellow}Error sending message to ${targetNumbers[i]}: ${sendError.message}. Retrying...${reset}`);
              await delay(5000);
            }
          }
        }

        // Reset message index after all messages are sent
        if (messageIndex >= messages.length) {
          messageIndex = 0;
          console.log(`${yellow}[•] All messages sent! Restarting...${reset}`);
        }
      }
    }

    const mainMenu = async (MznKing) => {
      clearScreen();
      console.log("[1] Show WhatsApp Group Names and IDs");
      console.log("[2] Send Messages to WhatsApp Groups and Target Numbers");
      const option = await question(`${green}Choose an option => ${reset}`);
      clearScreen();

      switch (option.trim()) {
        case '1':
          await listGroups(MznKing);
          console.log(`${yellow}Press Enter to go back to the main menu${reset}`);
          await question('');
          await mainMenu(MznKing);
          break;
        case '2':
          await sendMessageOptions(MznKing);
          break;
        default:
          console.log(`${yellow}Invalid option! Please try again.${reset}`);
          await mainMenu(MznKing);
          break;
      }
    };

    const sendMessageOptions = async (MznKing) => {
      // Handle WhatsApp groups
      const sendToGroups = await question(`${green}[+] Do you want to send messages to WhatsApp groups? (yes/no) => ${reset}`);
      if (sendToGroups.toLowerCase() === "yes") {
        console.log(`${green}[+] Fetching WhatsApp groups...${reset}`);
        await listGroups(MznKing);

        const numberOfGroups = await question(`${green}[+] Enter the number of WhatsApp groups to send messages to => ${reset}`);
        for (let i = 0; i < numberOfGroups; i++) {
          const groupId = await question(`${green}[+] Enter WhatsApp Group ID ${i + 1} from the list above => ${reset}`);
          groupIDs.push(groupId.trim());
        }

        groupHaterName = await question(`${green}[+] Enter Your WhatsApp Group Hater Name => ${reset}`);
      }

      // Handle WhatsApp chats
      const sendToChats = await question(`${green}[+] Do you want to send messages to WhatsApp chats? (yes/no) => ${reset}`);
      if (sendToChats.toLowerCase() === "yes") {
        const numberOfTargets = await question(`${green}[+] Enter the number of WhatsApp chats to send messages to => ${reset}`);
        for (let i = 0; i < numberOfTargets; i++) {
          const target = await question(`${green}[+] Enter Target Number ${i + 1} => ${reset}`);
          targetNumbers.push(target.trim());
        }

        chatHaterName = await question(`${green}[+] Enter Your Target Number Hater Name => ${reset}`);
      }

      // Message file path input
      const messageFilePath = await question(`${green}[+] Enter Message File Path => ${reset}`);
      messages = fs.readFileSync(messageFilePath, 'utf-8').split('\n').filter(Boolean);
      intervalTime = await question(`${green}[+] Enter Interval Between Messages (in seconds) => ${reset}`);

      clearScreen();
      console.log(`${green}[+] WhatsApp Groups => ${reset}${groupIDs.length ? groupIDs.join(', ') : 'None'}`);
      console.log(`${green}[+] Target Numbers => ${reset}${targetNumbers.length ? targetNumbers.join(', ') : 'None'}`);
      console.log(`${green}[+] Messages => ${reset}${messages.length ? messages.join(', ') : 'No messages'}`);
      console.log(`${green}[+] Interval Between Messages => ${reset}${intervalTime} seconds`);
      console.log(`${yellow}----------------------------------------------------------------${reset}`);

      await sendMessages(MznKing);
    };

    const listGroups = async (MznKing) => {
      try {
        const groups = await MznKing.groupFetchAllParticipating();
        const groupNames = Object.values(groups).map(group => `${green}Name => ${reset}${group.subject} ${green}ID => ${reset}${group.id.replace('@g.us', '')}`);
        console.log(groupNames.join('\n'));
      } catch (err) {
        console.log(`${yellow}Error fetching groups: ${err.message}${reset}`);
      }
    };

    connectToWhatsApp();
  } catch (err) {
    console.error(`${yellow}[•] Error in script execution: ${err.message}${reset}`);
  }
})();
