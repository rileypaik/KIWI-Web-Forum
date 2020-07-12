var { db } = require('../firebase');
var { admin } = require('../firebase');
var auth = require('../auth/index');

function addPostData(forumName, p_user_id, p_title, p_tag_ids, p_content) {

    const firebaseRef = db.database().ref(forumName + "/Posts");

    var today = new Date();
    var hours = today.getHours()
    var ampm = (today.getHours() >= 12 ? 'pm' : 'am');
    hours = (hours % 12);
    hours = hours ? hours : 12;
    var datetime = (today.getMonth() + 1) + '-' + today.getDate() + '-' + today.getFullYear()
                 + ' at '  + hours + ':'
                 + ((today.getMinutes() < 10)?"0":"") + today.getMinutes() + " " + ampm;

    try {
        var post_reference = firebaseRef.push({
            user_id: p_user_id,
            title: p_title,
            tag_ids: p_tag_ids,
            date_time: datetime,
            content: p_content,
            karma: 0,
            follower_ids: []

        });

        var updates = {};
        updates[p_user_id] = p_user_id;
        db.database().ref(forumName + "/Posts/" + post_reference.key + "/follower_ids").update(updates);

    } catch (error) {
        console.log(error);
        return false;
    }

    try {
        notifyUsers(forumName, p_tag_ids);

    } catch (error) {
        console.log(error);
        return false;
    }

    return true;

}

function notifyUsers(companyName, posts_tags) {

    if (posts_tags == null || posts_tags.length == 0) {
        return;
    }

    const firebaseRef = db.database().ref(companyName);

    firebaseRef.once('value', function (snapshot) {

        try {
            var users_array = Object.keys(snapshot.child("Users").val());
    
        } catch (error) {
            console.log(error);
            return false;
        }

        // For each user in the company
        for (i = 0; i < users_array.length; i++) {

            var user_id = users_array[i];
            var user_email = (snapshot.child("Users/" + user_id + "/email").val());

            try {
                var curr_user_tags = Object.keys(snapshot.child("Users/" + user_id + "/tags").val());
        
            } catch (error) {
                console.log(error);
                return false;
            }

            // For each tag in this user's list
            for (j = 0; j < curr_user_tags.length; j++) {
                var curr_tag = curr_user_tags[j];
                
                // If this tag is in the post
                if (posts_tags.indexOf(curr_tag, 0) != -1) {

                    var subject = "Relevant Post was created in " + companyName + "'s KIWI Forum";
                    var content = "A post tagged with at least one of your specialities in " + companyName + "'s KIWI Forum was created.";
                    sendEmail(user_email, subject, content);
                    break
                }
            }
        }
    });
}

// "POST" method for a new user 
function createNewUser(registration_ID, forumName, firstName, lastName, email, password, isAdmin) {

    return new Promise(function (resolve, reject) {

        try {

            // Check if user is admin and if the company already exists
            var alreadyCreated = false;
            if (isAdmin == true) {
                db.database().ref(forumName).once("value", snapshot => {
                    if (snapshot.exists()) {
                        alreadyCreated = true;
                        return;
                    }
                }).then((data) => {
                    if(alreadyCreated) {
                        resolve(false);
                        return;
                    }
                    const forumDBRef = db.database().ref(forumName);
                    auth.signUp(email, password, isAdmin).then((data) => {
                        var userID = data.uid;
                        var user = {};
                        // Creates a new user object with the userID as a key
                        user[userID] = {
                            firstName: firstName,
                            lastName: lastName,
                            email: email,
                            admin: isAdmin,
                            tags: { 'announcements': 'announcements', 'help-needed': 'help-needed' },
                            following_IDs: []
                        };
    
                        forumDBRef.child('Users').update(user);
                        var mapUserToCompany = {};
                        mapUserToCompany[userID] = forumName;
                        db.database().ref("UserCompaniesID").update(mapUserToCompany);
    
                        if (isAdmin == false) {
                            db.database().ref("Registrations").child(registration_ID).remove();
                        }
    
                        // Add the default 2 tags if it doesn't exist
                        forumDBRef.child('Tags').update({ "announcements": "announcements", "help-needed": "help-needed" });
    
                        resolve(true);
                    
                    }).catch((error) => {
                        console.log(error);
                        reject(new Error(error));
                    });
                })
            } else {
                const forumDBRef = db.database().ref(forumName);
                auth.signUp(email, password, isAdmin).then((data) => {
                    var userID = data.uid;
                    var user = {};
                    // Creates a new user object with the userID as a key
                    user[userID] = {
                        firstName: firstName,
                        lastName: lastName,
                        email: email,
                        admin: isAdmin,
                        tags: { 'announcements': 'announcements', 'help-needed': 'help-needed' },
                        following_IDs: []
                    };

                    forumDBRef.child('Users').update(user);
                    var mapUserToCompany = {};
                    mapUserToCompany[userID] = forumName;
                    db.database().ref("UserCompaniesID").update(mapUserToCompany);

                    if (isAdmin == false) {
                        db.database().ref("Registrations").child(registration_ID).remove();
                    }

                    // Add the default 2 tags if it doesn't exist
                    forumDBRef.child('Tags').update({ "announcements": "announcements", "help-needed": "help-needed" });

                    resolve(true);
                
                }).catch((error) => {
                    console.log(error);
                    reject(new Error(error));
                });
            }

        } catch (error) {
            console.log(error);
            reject(new Error(error));
        }
    })
}

function updateKarma(companyName, user_id, response_id) {

    return new Promise(function(resolve, reject){

        const firebaseRef = db.database().ref(companyName + '/Responses/' + response_id);

        var updates = {};
        firebaseRef.once('value', function(snapshot){

            var upvoters_array = (snapshot.child("upvoters").val());
        
            if(upvoters_array != null && upvoters_array.indexOf(user_id, 0) != -1) {
                reject(new Error("User already upvoted"))

            } else {

                if(upvoters_array == null) {
                    upvoters_array = [];
                }

                upvoters_array.push(user_id);
                updates["upvoters"] = upvoters_array;
                firebaseRef.update(updates);

                updates = {};
                firebaseRef.once('value', function(snapshot){
                    var karma = (snapshot.child("karma").val());
                    updates["karma"] = karma + 1;
                    firebaseRef.update(updates);

                    resolve(true)
    
                })

                .catch( function(error) {
                    console.log(error);
                })
            }

        });
    })
}

function endorseResponse(companyName, user_id, response_id) {

    return new Promise(function(resolve, reject){

        const firebaseRef = db.database().ref(companyName);
        
        firebaseRef.once('value', function(snapshot){

            var post_idOfResponse = (snapshot.child("Responses/"+response_id+"/post_id").val());

            var posts_array = Object.keys(snapshot.child("Posts").val());

            for(i = 0; i < posts_array.length; i++) {
                var curr_post_id = posts_array[i];

                if(curr_post_id == post_idOfResponse) {

                    var creator_of_post = (snapshot.child("Posts/"+curr_post_id+"/user_id").val());

                    if(user_id == creator_of_post) {
                        break
                    } else {
                        reject(new Error("Only the creator of the post can endorse this response."))
                        return
                    }
                }
            }

            const responseRef = db.database().ref(companyName + '/Responses/' + response_id);
            updates = {};
            responseRef.once('value', function(snapshot){
                var endorsed = (snapshot.child("endorsed").val());

                if(endorsed == true) {
                    reject(new Error("This response is already endorsed."))
                    return
                }

                updates["endorsed"] = true;
                responseRef.update(updates);

                resolve(true)
            })

            .catch( function(error) {
                console.log(error);
            })

        })
    })
}

function deletePostData(companyName, post_id) {

    const firebaseRef = db.database().ref(companyName);

    firebaseRef.once('value', function(snapshot){

        var responses_array = Object.keys(snapshot.child("Responses").val());

        for(i = 0; i < responses_array.length; i++) {
            var curr_response_id = responses_array[i];

            if((snapshot.child("Responses/"+curr_response_id+"/post_id").val()) == post_id) {
                firebaseRef.child("Responses/"+curr_response_id).remove();
            }
        }

        var user_array = Object.keys(snapshot.child("Users").val());

        for(i = 0; i < user_array.length; i++) {
            var curr_user_id = user_array[i];

            var curr_user_following = snapshot.child("Users/"+curr_user_id+"/following_ids").val();

            if(curr_user_following == null || curr_user_following.indexOf(post_id, 0) == -1) {
                continue;
            } else {
                var updates = {};
                post_id_index = curr_user_following.indexOf(post_id, 0);
                curr_user_following.splice(post_id_index, 1);
                updates["following_ids"] = curr_user_following;
                const followingRef = db.database().ref(companyName + '/Users/' + curr_user_id);
                followingRef.update(updates);
            }
        }
        firebaseRef.child("Posts/"+post_id).remove();
        return true;

    }) .catch( function(error) {
        console.log(error);
        return false;
    })
}

function deleteResponseData(companyName, response_id) {

    const firebaseRef = db.database().ref(companyName+"/Responses");
    try {
        firebaseRef.child(response_id).remove();

    } catch(error) {
        console.log(error);
        return false;
    }
    return true;
}

function undoUpvote(companyName, user_id, response_id) {

    return new Promise(function(resolve, reject){

        const firebaseRef = db.database().ref(companyName + '/Responses/' + response_id);
        var updates = {};
        firebaseRef.once('value', function(snapshot){

            var upvoters_array = (snapshot.child("upvoters").val());
        
            if(upvoters_array == null || upvoters_array.indexOf(user_id, 0) == -1) {
                reject(new Error("User did not upvote"))

            } else {

                upvoter_index = upvoters_array.indexOf(user_id, 0);
                upvoters_array.splice(upvoter_index, 1);
                updates["upvoters"] = upvoters_array;
                firebaseRef.update(updates);

                updates = {};
                firebaseRef.once('value', function(snapshot){
                    var karma = (snapshot.child("karma").val());
                    updates["karma"] = karma - 1;
                    firebaseRef.update(updates);

                    resolve(true)
    
                })

                .catch( function(error) {
                    console.log(error);
                })
            }

        });
    })
}

function undoEndorse(companyName, user_id, response_id) {

    return new Promise(function(resolve, reject){

        const firebaseRef = db.database().ref(companyName);
        
        firebaseRef.once('value', function(snapshot){

            var post_idOfResponse = (snapshot.child("Responses/"+response_id+"/post_id").val());

            var posts_array = Object.keys(snapshot.child("Posts").val());

            for(i = 0; i < posts_array.length; i++) {
                var curr_post_id = posts_array[i];

                if(curr_post_id == post_idOfResponse) {

                    var creator_of_post = (snapshot.child("Posts/"+curr_post_id+"/user_id").val());

                    if(user_id == creator_of_post) {
                        break
                    } else {
                        reject(new Error("Only the creator of the post can unendorse this response."))
                        return
                    }
                }
            }

            const responseRef = db.database().ref(companyName + '/Responses/' + response_id);
            updates = {};
            responseRef.once('value', function(snapshot){
                var endorsed = (snapshot.child("endorsed").val());

                if(endorsed == false) {
                    reject(new Error("This response is not endorsed."))
                    return
                }

                updates["endorsed"] = false;
                responseRef.update(updates);

                resolve(true)
            })

            .catch( function(error) {
                console.log(error);
            })

        })
    })
}

function userMadePost(companyName, user_id, post_id) {

    return new Promise(function (resolve, reject) {

        const firebaseRef = db.database().ref(companyName);

        firebaseRef.once('value', function (snapshot) {

            var posts_array = Object.keys(snapshot.child("Posts").val());

            for (i = 0; i < posts_array.length; i++) {
                var curr_post_id = posts_array[i];

                if (curr_post_id == post_id) {

                    var creator_of_post = (snapshot.child("Posts/" + curr_post_id + "/user_id").val());

                    if (user_id == creator_of_post) {
                        resolve(true);
                        return;
                    } else {
                        resolve(false);
                        return;
                    }
                }
            }
        });
    })
}

function upVotePost(forumName, post_id) {
    const firebaseRef = db.database().ref(forumName + "/Posts" + post_id);
    firebaseRef.update({ karma: karma + 1 });
}

var mailgun = require("mailgun-js");
require('dotenv').config();

const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: 'mg.kiwis.tech',
});

function sendEmail(email, subject, content) {
    const data = {
        "from": "KIWI Forum <no-reply@mg.kiwis.tech>",
        "to": email,
        "subject": subject ? subject : 'Hello',
        "text": content,
    }
    mg.messages().send(data, function (error, body) {
        console.log(body);
        console.log(error);
    })
}

module.exports = {
    addPostData, notifyUsers, createNewUser, updateKarma, endorseResponse, deletePostData,
    deleteResponseData, undoUpvote, undoEndorse, userMadePost, upVotePost
};