img?=cerit.io/ljocha/aspdb-blast


build:
	docker build --platform linux/amd64 -t ${img} .

push:
	docker push ${img}

bash:
	docker run -ti --rm ${img} bash


run:
	docker run -ti --rm -p 8080:8080 ${img}
