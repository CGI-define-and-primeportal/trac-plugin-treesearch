#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2013 CGI IT UK Ltd

from setuptools import setup

setup(
    name='TreeSearchPlugin',
    version=0.1,
    description='Displays a tree kind of view for files and folders in svn path',
    author="Sivachandran Pushpanathan",
    author_email="sivachandran.pushpanathan@cgi.com",
    license='BSD',
    url='https://d4.define.logica.com',
    packages=['treesearch'],
    package_data={
        'treesearch': [
            'htdocs/css/*.css',
            'htdocs/js/*.js',
        ]
    },
    entry_points={
        'trac.plugins': [
            'treesearch.filter = treesearch.filter',
        ]
    },
)
