var express = require("express");
var router = express.Router();
var {authenticated} = require('../auth/index');
var dbIndex = require('../../db/index')

router.get('/:id', 
    function (req, res) {
        let user_id = req.user.id;
        let company = req.user.company;

        dbIndex.getPostInfo(company, req.params.id).then((posts) => {
            dbIndex.pullResponse(company, req.params.id).then((responseData) => {
                dbIndex.userMadePost(company, user_id, req.params.id).then((result) => {
                    dbIndex.getUpvoteArray(responseData, user_id).then((array) => {
                        res.jsonp({ posts: posts, responses: responseData, createdPost: result, responseBools: array })
                    
                    })

                }).catch((error) => {
                    console.log(error);
                    res.jsonp({ success: false });
                })

            }).catch((error) =>{
                console.log(error);
                res.jsonp({ success: false });
            })
        }).catch((error) => {
            console.log(error);
            res.jsonp({success: false});
        })

    });

router.post('/CreatePost', (req, res, next) => {
    var company_name = req.user.company;
    var user_id = req.user.id;
    var pushedData = dbIndex.addPostData(company_name, user_id, req.body.title, req.body.tag_ids, req.body.content);
    res.jsonp({success : pushedData});
    }
)

router.post('/DeletePostData', (req, res) => {
    var company_name = req.user.company;
    var post_id = req.body.post_id;
    var deletedData = dbIndex.deletePostData(company_name, post_id);
    res.jsonp({success : deletedData});
    
})

module.exports = router;