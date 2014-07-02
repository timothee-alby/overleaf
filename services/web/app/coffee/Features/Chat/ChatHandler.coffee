request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

module.exports = 

	sendMessage: (project_id, user_id, messageContent, callback)->
		opts =
			method:"post"
			json:
				content:messageContent
				user_id:user_id
			uri:"#{settings.apis.chat.url}/room/#{project_id}/messages"
		request opts, (err, response, body)->
			if err?
				logger.err err:err, "problem sending new message to chat"
			callback(err, body)



	getMessages: (project_id, query, callback)->
		opts =
			uri:"#{settings.apis.chat.url}/room/#{project_id}/messages"
			method:"get"
		request opts, (err, response, body)->
			callback(err, body)