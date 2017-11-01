package com.colibri.tracker.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import com.colibri.tracker.model.Position;

/**
 * Created by gabriel.delgado on 11/1/17.
 */

@RequestMapping("/api")
@RestController
public class PositionController {
    @RequestMapping(method = RequestMethod.GET, produces = {MediaType.APPLICATION_JSON_VALUE})
    public Position index() {
        return new Position(1, 1234567, 7654321);
    }
}
