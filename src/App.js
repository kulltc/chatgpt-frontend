import React, { useState, useEffect } from "react";
import axios from "axios";
import CryptoJS from 'crypto-js';
import "./App.css";


const Chat = ({ conversation, onSelect, isActive, handleDelete, conversations }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    const json = JSON.stringify(conversation.messages, null, 2);
    navigator.clipboard.writeText(json).then(
      () => {
        console.log("Messages copied to clipboard");
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 2000);
      },
      (err) => {
        console.error("Could not copy messages: ", err);
      }
    );
  };

  return (
    <div
      className={`chat ${isActive ? "chat-active" : ""}`}
      onClick={() => onSelect(() => conversations.find((c) => c.id === conversation.id))}
    >
      <div>Conversation {conversation.id}</div>
      <div
        onClick={handleCopy}
        role="button"
        className="copy-icon-container"
      >
       ⬇ {/*Copy icon*/}
        {showTooltip && (
          <span className="copy-tooltip">
            Copied!
          </span>
        )}
      </div>
      <div
        onClick={() => {window.confirm("Are you sure you want to delete this conversation?") && handleDelete(conversation.id)}}
        role="button"
        className="delete-icon-container"
      >
       🗑 {/*Delete icon*/}
      </div>
    </div>
  );
};

const Message = ({ message, onEdit, onDelete, isEditing, onSave, onCancel, updateEditingMessage, editingMessage}) => {
  if (isEditing) {
    return (
      <EditMessage
        editingMessage={editingMessage}
        onSave={onSave}
        onCancel={onCancel}
        updateEditingMessage={updateEditingMessage}
      />
    );
  }

  return (
    <div className={`message ${message.role}`}>
      <span>{message.content}</span>
      <span className="message-icons">
        <span onClick={onEdit}>&#9998;</span> {/* Edit icon */}
        <span onClick={onDelete}>&#128465;</span> {/* Trash can icon */}
      </span>
    </div>
  )
}

const MessageInput = ({ messageText, setMessageText, sendMessage }) => {
  const [selectedModel, setSelectedModel] = useState("gpt-3.5-turbo");

  return (
    <div className="input">
      <textarea
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(selectedModel);
            setMessageText("");
          }
        }}
      />
      <button
        onClick={() => {
          sendMessage(selectedModel);
          setMessageText("");
        }}
      >
        Send
      </button>
      <select
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        style={{ marginLeft: "10px" }}
      >
        <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
        <option value="gpt-4">gpt-4</option>
      </select>
    </div>
  );
};

const EditMessage = ({ editingMessage, updateEditingMessage, onSave, onCancel }) => (
  <div className="edit-message">
    <input
      type="text"
      value={editingMessage.content}
      onChange={(e) => updateEditingMessage(e.target.value)}
    />
    <button onClick={onSave}>Save</button>
    <button onClick={onCancel}>Cancel</button>
  </div>
);

const APIKeyInput = ({ onSubmit }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = () => {
    onSubmit(apiKey);
  };

  return (
    <div>
      <h2>Enter your OpenAI API Key</h2>
      <input
        type="text"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
};


const App = () => {

  const getAPIKey = () => {
    const encryptedKey = localStorage.getItem('OPENAI_API_KEY');
    if (encryptedKey) {
      const decryptedKey = CryptoJS.AES.decrypt(encryptedKey, 'secret_key');
      return decryptedKey.toString(CryptoJS.enc.Utf8);
    }
    return null;
  };

  const [conversations, setConversations] = useState(() => {
    const storedConversations = localStorage.getItem("conversations");
    return storedConversations ? JSON.parse(storedConversations) : [];
  }); 
  const [activeConversation, setActiveConversation] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [editingMessage, setEditingMessage] = useState(null);
  const [OPENAI_API_KEY, setOPENAI_API_KEY] = useState(getAPIKey());
  const [deletedConversationId, setDeletedConversationId] = useState(null);


  const setAPIKey = (key) => {
    const encryptedKey = CryptoJS.AES.encrypt(key, 'secret_key').toString();
    localStorage.setItem('OPENAI_API_KEY', encryptedKey);
  };
  
  useEffect(() => {
    const storedConversations = localStorage.getItem("conversations");
    if (storedConversations) {
      setConversations(JSON.parse(storedConversations));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("conversations", JSON.stringify(conversations));
  }, [conversations]);

  const addConversation = () => {
    const newConversation = { id: conversations.length + 1, messages: [] };
    setConversations([...conversations, newConversation]);
    setActiveConversation(newConversation);
  };

  const sendMessage = async (model) => {
    if (!messageText) return;
  
    const userMessage = { role: "user", content: messageText };
    const updatedMessages = [...activeConversation.messages, userMessage];
  
    const assistantMessage = await getAssistantResponse(updatedMessages, model);
    const newMessages = [...updatedMessages, assistantMessage];
  
    setActiveConversation({ ...activeConversation, messages: newMessages });
  
    setConversations((prevConversations) =>
      prevConversations.map((conversation) =>
        conversation.id === activeConversation.id
          ? { ...conversation, messages: newMessages }
          : conversation
      )
    );
  };
  
  const getAssistantResponse = async (messages, model) => {
    const requestBody = {
      model: model,
      messages,
      temperature: 0.7,
    };

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );

      const assistantMessage = response.data.choices[0].message;
      return assistantMessage;
    } catch (error) {
      console.error("Error fetching assistant response:", error);
      return { role: "assistant", content: "Error: Unable to fetch response." };
    }
  };

  const deleteMessage = (messageIndex) => {
    if (window.confirm("Do you want to delete this message?")) {
      const newMessages = activeConversation.messages.filter(
        (_, index) => index !== messageIndex
      );
      setActiveConversation({ ...activeConversation, messages: newMessages });
      setConversations((prevConversations) =>
        prevConversations.map((conversation) =>
          conversation.id === activeConversation.id
            ? { ...conversation, messages: newMessages }
            : conversation
        )
      );
    }
  };

  const editMessage = (messageIndex) => {
    setEditingMessage({
      index: messageIndex,
      content: activeConversation.messages[messageIndex].content,
    });
  }; 

  const updateEditingMessage = (updatedContent) => {
    setEditingMessage({ ...editingMessage, content: updatedContent });
  };  

  const saveEditedMessage = () => {
    const newMessages = activeConversation.messages.map((message, index) =>
      index === editingMessage.index ? { ...message, content: editingMessage.content } : message
    );
    setActiveConversation({ ...activeConversation, messages: newMessages });
    setConversations((prevConversations) =>
      prevConversations.map((conversation) =>
        conversation.id === activeConversation.id
          ? { ...conversation, messages: newMessages }
          : conversation
      )
    );
    setEditingMessage(null);
  };
  
  const addNewMessage = (role) => {
    const newMessage = {
      role,
      content: "",
    };
    const newMessages = [...activeConversation.messages, newMessage];
    setActiveConversation({ ...activeConversation, messages: newMessages });
    setEditingMessage({ index: newMessages.length - 1, content: newMessage.content });
  };  

  const deleteConversation = (conversationId) => {
    console.log(activeConversation)
    // Filter out the conversation to be deleted
    const updatedConversations = conversations.filter(
      (conversation) => conversation.id !== conversationId
    );
  
    // Re-index the conversation IDs
    updatedConversations.forEach((conversation, index) => {
      conversation.id = index + 1;
    });
    
    // Set the new state values
    setConversations(updatedConversations);
    setDeletedConversationId(conversationId);
  };
  
  //Effect to handle case where the current conversation is deleted.
  useEffect(() => {
    let newId
    if (deletedConversationId === null) {
      return
    } 
    console.log(deletedConversationId, activeConversation.id)
    if (activeConversation && activeConversation.id < deletedConversationId) {
      return
    }
    if (activeConversation && activeConversation.id == deletedConversationId) {
      newId = 0
    } else {
      newId = activeConversation.id - 1
    }
    console.log(newId)
    setActiveConversation(
      conversations.length > 0
        ? conversations[newId]
        : { id: null, messages: [] }
    );
    setDeletedConversationId(null); // Reset the deleted conversation id state
  }, [conversations, activeConversation, deletedConversationId]);
  

  return (
    <div className="app">
      <div className="nav">
        <button onClick={addConversation}>New Conversation</button>
          {conversations.map((conversation) => (
            <Chat
              key={conversation.id}
              conversation={conversation}
              onSelect={(getConversation) => setActiveConversation(getConversation())}
              conversations={conversations}
              isActive={activeConversation && activeConversation.id === conversation.id}
              handleDelete={deleteConversation}
            />
          ))}
      </div>
      <div className="main">
        <div className="content">
          {activeConversation && (
            <div className="messages">
              {activeConversation.messages.map((message, index) => (
                <Message
                  key={index}
                  message={message}
                  isEditing={editingMessage && editingMessage.index === index}
                  updateEditingMessage={updateEditingMessage}
                  editingMessage={editingMessage}
                  onEdit={() => editMessage(index)}
                  onDelete={() => deleteMessage(index)}
                  onSave={() => saveEditedMessage()}
                  onCancel={() => setEditingMessage(null)}
                />
              ))}
              <div className="add-message">
                <button className="add-message-btn" onClick={() => addNewMessage("user")}>+ User msg</button>
                <button className="add-message-btn" onClick={() => addNewMessage("assistant")}>+ Assistant msg</button>
                <button className="add-message-btn" onClick={() => addNewMessage("system")}>+ System msg</button>
              </div>
            </div>
          )}
          {OPENAI_API_KEY ? (
            <MessageInput
            messageText={messageText}
            setMessageText={setMessageText}
            sendMessage={sendMessage}
            />
          ) : (
            <APIKeyInput
              onSubmit={(key) => {
                setAPIKey(key);
                setOPENAI_API_KEY(key);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;



