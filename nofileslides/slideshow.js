"use strict";

if (typeof Chart !== "undefined" &&
    typeof ChartDataLabels !== "undefined") {
    Chart.register(ChartDataLabels);
}

/*
|--------------------------------------------------------------------------
| Slideshow state
|--------------------------------------------------------------------------
*/

const STORAGE_KEY = "nofileslides:draft:v1";
let saveTimer = null;
let statusTimer = null;

const imageCache = new Map();   // url -> { image, state }
const IMAGE_CACHE_LIMIT = 50;
let imageRenderTimer = null;

const slideshow = {

    settings: {
        width: 1920,
        height: 1080,
        transition: "fade",
        duration: 5000,
        autoplay: false
    },

    slides: [
        createSlide({
            layout: "title-subtitle",
            title: "My presentation",
            //subtitle: "A simple slideshow"
        })
    ]

};

let currentSlideIndex = 0;
let chartInstance = null;


/*
|--------------------------------------------------------------------------
| Initialization
|--------------------------------------------------------------------------
*/

document.addEventListener("DOMContentLoaded", () => {

    if (document.getElementById("builder")) {
        initializeBuilder();
    }

});


// function initializeBuilder() {

//     bindControls();
//     render();

// }

function initializeBuilder() {

    loadState();
    bindControls();
    render();

    // Make sure a pending save isn't lost when the tab closes.
    window.addEventListener("pagehide", saveState);

}

/*
|--------------------------------------------------------------------------
| Slide creation
|--------------------------------------------------------------------------
*/

function createSlide(options = {}) {
    return {
        id: createId(),
    
        layout: options.layout || "title-subtitle",
    
        background: options.background || "#ffffff",
    
        textAlign: options.textAlign || "left",
    
        textColor: options.textColor || "#111827",
    
        title: options.title || "",
    
        subtitle: options.subtitle || "",
    
        bullets: options.bullets || [],
    
        references: options.references || [],

        imageUrl: options.imageUrl || "",
    
        chart: options.chart || {
            type: "bar",
            series: "Series",
            labels: [
                "Q1",
                "Q2",
                "Q3",
                "Q4"
            ],
            values: [
                120,
                180,
                150,
                220
            ]
        }
    };
}


function createId() {

    return (
        "slide-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 8)
    );

}


/*
|--------------------------------------------------------------------------
| Current slide
|--------------------------------------------------------------------------
*/

function getCurrentSlide() {

    return slideshow.slides[currentSlideIndex];

}


/*
|--------------------------------------------------------------------------
| Controls
|--------------------------------------------------------------------------
*/

function bindControls() {

    document
        .getElementById("add-slide")
        .addEventListener("click", addSlide);


    document
        .getElementById("delete-slide")
        .addEventListener("click", deleteCurrentSlide);


    document
        .getElementById("previous-slide")
        .addEventListener("click", previousSlide);


    document
        .getElementById("next-slide")
        .addEventListener("click", nextSlide);


    document
        .getElementById("slide-layout")
        .addEventListener("change", event => {

            const slide = getCurrentSlide();

            slide.layout = event.target.value;

            render();

        });


    document
        .getElementById("slide-background")
        .addEventListener("input", event => {

            const slide = getCurrentSlide();

            slide.background = event.target.value;

            updateBackgroundLabel();
            renderPreview();

        });


    // document
    //     .getElementById("slide-title")
    //     .addEventListener("input", event => {

    //         getCurrentSlide().title = event.target.value;

    //         renderPreview();

    //     });


    // document
    //     .getElementById("slide-subtitle")
    //     .addEventListener("input", event => {

    //         getCurrentSlide().subtitle = event.target.value;

    //         renderPreview();

    //     });

    document
        .getElementById("slide-title")
        .addEventListener("input", event => {
            getCurrentSlide().title = parseText(event.target.value);
            renderPreview();
        });

    document
        .getElementById("slide-subtitle")
        .addEventListener("input", event => {
            getCurrentSlide().subtitle = parseText(event.target.value);
            renderPreview();
        });


    document
        .getElementById("slide-bullets")
        .addEventListener("input", event => {

            getCurrentSlide().bullets =
                parseLines(event.target.value);

            renderPreview();

        });


    document
        .getElementById("slide-references")
        .addEventListener("input", event => {

            getCurrentSlide().references =
                parseLines(event.target.value);

            renderPreview();

        });

    // // align
    // document
    //     .getElementById("text-align")
    //     .addEventListener("change", event => {
    
    //         getCurrentSlide().textAlign =
    //             event.target.value;
    
    //         renderPreview();
    
    //     });

    document.querySelectorAll(".alignment-button").forEach(button => {
        button.addEventListener("click", () => {
        getCurrentSlide().textAlign = button.dataset.align;
        updateControls();
        renderPreview();
        });
    });
        
    
    // text color
    document
        .getElementById("text-color")
        .addEventListener("input", event => {
    
            getCurrentSlide().textColor =
                event.target.value;
    
            updateTextColorLabel();
            renderPreview();
    
        });


    //image
    document
        .getElementById("slide-image-url")
        .addEventListener("input", event => {
            getCurrentSlide().imageUrl = event.target.value.trim();

            // Wait until typing/pasting settles before loading anything.
            clearTimeout(imageRenderTimer);
            imageRenderTimer = setTimeout(renderPreview, 600);
        });

    // document
    //     .getElementById("slide-image-url")
    //     .addEventListener("input", event => {
    //         getCurrentSlide().imageUrl = event.target.value.trim();
    //         renderPreview();
    //     });
    /*
    |--------------------------------------------------------------------------
    | Chart controls
    |--------------------------------------------------------------------------
    */

    document
        .getElementById("chart-type")
        .addEventListener("change", event => {

            getCurrentSlide().chart.type =
                event.target.value;

            renderPreview();

        });


    document
        .getElementById("chart-series")
        .addEventListener("input", event => {

            getCurrentSlide().chart.series =
                event.target.value;

            renderPreview();

        });


    document
        .getElementById("chart-labels")
        .addEventListener("input", event => {

            getCurrentSlide().chart.labels =
                parseLines(event.target.value);

            renderPreview();

        });


    document
        .getElementById("chart-values")
        .addEventListener("input", event => {

            getCurrentSlide().chart.values =
                parseChartValues(event.target.value);

            renderPreview();

        });


    // document
    //     .getElementById("preview-slideshow")
    //     .addEventListener(
    //         "click",
    //         previewSlideshow
    //     );


    document
        .getElementById("share-slideshow")
        .addEventListener(
            "click",
            shareSlideshow
        );


    /*
    |--------------------------------------------------------------------------
    | Keyboard navigation
    |--------------------------------------------------------------------------
    */

    document.addEventListener("keydown", event => {

        const activeElement =
            document.activeElement;

        const isEditing =
            activeElement &&
            (
                activeElement.tagName === "INPUT" ||
                activeElement.tagName === "TEXTAREA" ||
                activeElement.tagName === "SELECT"
            );


        if (isEditing) {
            return;
        }


        if (event.key === "ArrowLeft") {

            previousSlide();

        }


        if (event.key === "ArrowRight") {

            nextSlide();

        }


        if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey)
        ) {

            addSlide();

        }

    });

    document
        .getElementById("new-slideshow")
        .addEventListener("click", newSlideshow);

    /*
    |--------------------------------------------------------------------------
    | Import
    |--------------------------------------------------------------------------
    */

    const importInput = document.getElementById("import-url");

    document
        .getElementById("import-slideshow")
        .addEventListener("click", importSlideshow);

    importInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            importSlideshow();
        }
    });

    importInput.addEventListener("input", () => {
        importInput.classList.remove("invalid");
        importInput.title = "";
    });



    const importToggle = document.getElementById("import-toggle");

    importToggle.addEventListener("click", () => {
        const toolbar = document.querySelector(".preview-toolbar");
        const open = toolbar.classList.toggle("import-open");

        importToggle.setAttribute("aria-expanded", String(open));

        if (open) {
            importInput.focus();
        }
    });

}


/*
|--------------------------------------------------------------------------
| Add slide
|--------------------------------------------------------------------------
*/

function addSlide() {

    const slide = getCurrentSlide();

    const newSlide = createSlide({

        layout: "title-subtitle",

        title: "New slide",

        subtitle: "",

        textColor: slide.textColor,
        
        background: slide.background,

    });


    slideshow.slides.push(newSlide);

    currentSlideIndex =
        slideshow.slides.length - 1;

    render();

}


/*
|--------------------------------------------------------------------------
| Delete slide
|--------------------------------------------------------------------------
*/

function deleteCurrentSlide() {

    if (slideshow.slides.length <= 1) {

        alert("A slideshow must contain at least one slide.");

        return;

    }


    slideshow.slides.splice(
        currentSlideIndex,
        1
    );


    if (
        currentSlideIndex >=
        slideshow.slides.length
    ) {

        currentSlideIndex =
            slideshow.slides.length - 1;

    }


    render();

}


/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

function previousSlide() {

    if (currentSlideIndex <= 0) {
        return;
    }

    currentSlideIndex--;

    render();

}


function nextSlide() {

    if (
        currentSlideIndex >=
        slideshow.slides.length - 1
    ) {

        return;

    }

    currentSlideIndex++;

    render();

}


function selectSlide(index) {

    if (
        index < 0 ||
        index >= slideshow.slides.length
    ) {

        return;

    }

    currentSlideIndex = index;

    render();

}


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function parseLines(value) {
    return value
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);
}

function parseText(value) {
    return value.replace(/\r\n/g, "\n");
}

function linesToText(lines) {

    return lines.join("\n");

}


function parseChartValues(value) {

    return value
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(value => {

            const number = Number(value);

            return Number.isFinite(number)
                ? number
                : 0;

        });

}


/*
|--------------------------------------------------------------------------
| Main render
|--------------------------------------------------------------------------
*/

function render() {

    updateSlideList();

    updateControls();

    renderPreview();

    updateNavigation();

}


/*
|--------------------------------------------------------------------------
| Slide list
|--------------------------------------------------------------------------
*/

function updateSlideList() {

    const list =
        document.getElementById("slides-list");

    list.innerHTML = "";


    slideshow.slides.forEach(
        (slide, index) => {

            const item =
                document.createElement("button");

            item.type = "button";

            item.className =
                "slide-item";


            //alias
            const button = item;

            button.draggable = true;
            button.dataset.slideIndex = index;

            button.addEventListener("dragstart", event => {
                event.dataTransfer.setData("text/plain", index);
                button.classList.add("dragging");
            });
            
            button.addEventListener("dragend", () => {
                button.classList.remove("dragging");
            });

            button.addEventListener("dragover", event => {
                event.preventDefault();
                button.classList.add("drag-over");
            });
            
            button.addEventListener("dragleave", () => {
                button.classList.remove("drag-over");
            });
            
            button.addEventListener("drop", event => {
                event.preventDefault();
            
                button.classList.remove("drag-over");
            
                const fromIndex = Number(
                    event.dataTransfer.getData("text/plain")
                );
            
                const toIndex = index;
            
                if (fromIndex === toIndex) {
                    return;
                }
            
                const [movedSlide] = slideshow.slides.splice(fromIndex, 1);
            
                slideshow.slides.splice(toIndex, 0, movedSlide);
            
                currentSlideIndex = toIndex;
            
                render();
            });

            if (index === currentSlideIndex) {

                item.classList.add("active");

            }


            const number =
                document.createElement("span");

            number.className =
                "slide-number";

            number.textContent =
                index + 1;


            const name =
                document.createElement("span");

            name.className =
                "slide-name";

            name.textContent =
                getSlideListName(slide, index);


            item.appendChild(number);

            item.appendChild(name);


            item.addEventListener(
                "click",
                () => selectSlide(index)
            );


            list.appendChild(item);

        }
    );

}


function getSlideListName(slide, index) {

    if (slide.title.trim()) {

        return slide.title.trim();

    }


    if (slide.layout === "chart") {

        return "Chart";

    }


    return `Slide ${index + 1}`;

}


/*
|--------------------------------------------------------------------------
| Controls synchronization
|--------------------------------------------------------------------------
*/

function updateControls() {

    const slide =
        getCurrentSlide();


    document
        .getElementById("slide-layout")
        .value =
        slide.layout;


    document
        .getElementById("slide-background")
        .value =
        slide.background;


    document
        .getElementById("slide-title")
        .value =
        slide.title;


    document
        .getElementById("slide-subtitle")
        .value =
        slide.subtitle;


    document
        .getElementById("slide-bullets")
        .value =
        linesToText(slide.bullets);


    document
        .getElementById("slide-references")
        .value =
        linesToText(slide.references);

    document.getElementById("slide-image-url").value = slide.imageUrl || "";

    /*
    |--------------------------------------------------------------------------
    | Chart controls
    |--------------------------------------------------------------------------
    */

    document
        .getElementById("chart-type")
        .value =
        slide.chart.type;


    document
        .getElementById("chart-series")
        .value =
        slide.chart.series;


    document
        .getElementById("chart-labels")
        .value =
        linesToText(slide.chart.labels);


    document
        .getElementById("chart-values")
        .value =
        linesToText(slide.chart.values);

    // document
    //     .getElementById("text-align")
    //     .value =
    //     slide.textAlign;
    document.querySelectorAll(".alignment-button").forEach(button => {
        const isActive = button.dataset.align === slide.textAlign;
        
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
        
        });

    document
        .getElementById("text-color")
        .value =
        slide.textColor;

    updateTextColorLabel();

    updateControlVisibility();

    updateBackgroundLabel();

}


/*
|--------------------------------------------------------------------------
| Control visibility
|--------------------------------------------------------------------------
*/

function updateControlVisibility() {

    const slide =
        getCurrentSlide();


    const bulletsField =
        document.getElementById(
            "bullets-field"
        );


    const subtitleField =
        document.getElementById(
            "subtitle-field"
        );


    const chartFields =
        document.getElementById(
            "chart-fields"
        );


    /*
    |--------------------------------------------------------------------------
    | Bullets
    |--------------------------------------------------------------------------
    */

    if (slide.layout === "bullets") {

        bulletsField.style.display = "block";

    } else {

        bulletsField.style.display = "none";

    }


    /*
    |--------------------------------------------------------------------------
    | Subtitle
    |--------------------------------------------------------------------------
    */

    // if (slide.layout === "title") {
    //     const content = document.querySelector('.slide-content');
    //     content.style.display = "flex";
    //     content.style.flexDirection = "column";
    //     content.style.justifyContent = "center";
    //     content.style.alignItems = "center";
    //     console.log(slide);
    // }

    if (slide.layout === "title-subtitle" /*|| slide.layout === "title"*/ ) {

        subtitleField.style.display =
            "block";

    } else {

        subtitleField.style.display =
            "none";

    }


    /*
    |--------------------------------------------------------------------------
    | Chart
    |--------------------------------------------------------------------------
    */

    if (slide.layout === "chart") {

        chartFields.classList.add("visible");

    } else {

        chartFields.classList.remove("visible");

    }

}


/*
|--------------------------------------------------------------------------
| Background label
|--------------------------------------------------------------------------
*/

function updateBackgroundLabel() {

    const color =
        document.getElementById(
            "slide-background"
        ).value;


    document
        .getElementById("background-value")
        .textContent =
        color;

}


/*
|--------------------------------------------------------------------------
| Navigation UI
|--------------------------------------------------------------------------
*/

function updateNavigation() {

    const counter =
        document.getElementById(
            "slide-counter"
        );


    const previous =
        document.getElementById(
            "previous-slide"
        );


    const next =
        document.getElementById(
            "next-slide"
        );


    counter.textContent =
        `${currentSlideIndex + 1} / ${slideshow.slides.length}`;


    previous.disabled =
        currentSlideIndex === 0;


    next.disabled =
        currentSlideIndex ===
        slideshow.slides.length - 1;

}


/*
|--------------------------------------------------------------------------
| Preview
|--------------------------------------------------------------------------
*/

function renderPreview() {

    const slide =
        getCurrentSlide();


    const preview =
        document.getElementById(
            "slide-preview"
        );


    /*
    |--------------------------------------------------------------------------
    | Destroy previous chart
    |--------------------------------------------------------------------------
    */

    destroyChart();


    /*
    |--------------------------------------------------------------------------
    | Reset preview
    |--------------------------------------------------------------------------
    */

    preview.innerHTML = "";

    preview.className = "slide";

   // preview.style.background = slide.background;
   renderSlideImage(slide, preview);
   preview.style.background = slide.background;


    preview.style.color =
        slide.textColor;
    
    preview.style.textAlign =
        slide.textAlign;

    /*
    |--------------------------------------------------------------------------
    | Content container
    |--------------------------------------------------------------------------
    */

    const content =
        document.createElement("div");

    content.className =
        "slide-content";

    content.style.textAlign =
        slide.textAlign;

    preview.appendChild(content);


    /*
    |--------------------------------------------------------------------------
    | Layout rendering
    |--------------------------------------------------------------------------
    */

    switch (slide.layout) {

        case "title":

            renderTitleSlide(
                slide,
                content
            );

            break;


        case "title-subtitle":

            renderTitleSubtitleSlide(
                slide,
                content
            );

            break;


        case "bullets":

            renderBulletSlide(
                slide,
                content
            );

            break;


        case "chart":

            renderChartSlide(
                slide,
                content
            );

            break;


        case "blank":

            renderBlankSlide(
                slide,
                content
            );

            break;

    }


    /*
    |--------------------------------------------------------------------------
    | References
    |--------------------------------------------------------------------------
    */

    renderReferences(
        slide,
        preview
    );

    scheduleSave();

}


/*
|--------------------------------------------------------------------------
| Title slide
|--------------------------------------------------------------------------
*/

function renderTitleSlide(
    slide,
    content
) {

    const title =
        document.createElement("h1");

    title.className =
        "slide-title";

    title.textContent =
        slide.title;


    content.appendChild(title);


    if (slide.subtitle) {

        const subtitle =
            document.createElement("p");

        subtitle.className =
            "slide-subtitle";

        subtitle.textContent =
            slide.subtitle;


        content.appendChild(subtitle);

    }

}


/*
|--------------------------------------------------------------------------
| Title + subtitle
|--------------------------------------------------------------------------
*/

function renderTitleSubtitleSlide(
    slide,
    content
) {

    renderTitleSlide(
        slide,
        content
    );

}


/*
|--------------------------------------------------------------------------
| Bullet slide
|--------------------------------------------------------------------------
*/

function renderBulletSlide(
    slide,
    content
) {

    const title =
        document.createElement("h1");

    title.className =
        "slide-title";

    title.textContent =
        slide.title;


    content.appendChild(title);


    if (slide.bullets.length > 0) {

        const list =
            document.createElement("ul");


        slide.bullets.forEach(
            bullet => {

                const item =
                    document.createElement("li");

                item.textContent =
                    bullet;

                list.appendChild(item);

            }
        );


        content.appendChild(list);

    }

}


/*
|--------------------------------------------------------------------------
| Blank slide
|--------------------------------------------------------------------------
*/

function renderBlankSlide(
    slide,
    content
) {

    if (!slide.title) {
        return;
    }


    const title =
        document.createElement("h1");

    title.className =
        "slide-title";

    title.textContent =
        slide.title;


    content.appendChild(title);

}


/*
|--------------------------------------------------------------------------
| Chart slide
|--------------------------------------------------------------------------
*/

function renderChartSlide(
    slide,
    content
) {

    const preview =
        document.getElementById(
            "slide-preview"
        );


    preview.classList.add(
        "chart-slide"
    );


    /*
    |--------------------------------------------------------------------------
    | Title
    |--------------------------------------------------------------------------
    */

    if (slide.title) {

        const title =
            document.createElement("h1");

        title.className =
            "slide-title";

        title.textContent =
            slide.title;


        content.appendChild(title);

    }


    /*
    |--------------------------------------------------------------------------
    | Chart container
    |--------------------------------------------------------------------------
    */

    const chartContainer =
        document.createElement("div");

    chartContainer.className =
        "chart-container";


    const canvas =
        document.createElement("canvas");


    chartContainer.appendChild(canvas);

    content.appendChild(
        chartContainer
    );


    /*
    |--------------------------------------------------------------------------
    | Validate data
    |--------------------------------------------------------------------------
    */

    const labels =
        slide.chart.labels || [];


    const values =
        slide.chart.values || [];


    if (labels.length === 0) {

        return;

    }


    /*
    |--------------------------------------------------------------------------
    | Match labels and values
    |--------------------------------------------------------------------------
    */

    const count =
        Math.min(
            labels.length,
            values.length
        );


    const chartLabels =
        labels.slice(0, count);


    const chartValues =
        values.slice(0, count);


    /*
    |--------------------------------------------------------------------------
    | Create Chart.js chart
    |--------------------------------------------------------------------------
    */

    chartInstance =
        new Chart(
            canvas.getContext("2d"),
            {

                type: slide.chart.type,

                data: {

                    labels: chartLabels,

                    datasets: [

                        {

                            label:
                                slide.chart.series ||
                                "Series",

                            data: chartValues,

                            borderWidth: 2,

                            tension: 0.3

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    animation: false,

                    plugins: {

                        legend: {

                            display:
                                slide.chart.type !== "pie" &&
                                slide.chart.type !== "doughnut"

                        },
                        datalabels: {
                            display: true,
                            color: "#ffffff",
                            font: {
                                weight: "bold",
                                size: 14
                            },
                            formatter: (value, context) => {
                                const label = context.chart.data.labels[context.dataIndex];
                        
                                if (
                                    context.chart.config.type === "pie" ||
                                    context.chart.config.type === "doughnut"
                                ) {
                                    return `${label}\n${value}`;
                                }
                        
                                return value;
                            }
                        }

                    },

                    scales:
                        slide.chart.type === "pie" ||
                            slide.chart.type === "doughnut"

                            ? {}

                            : {

                                y: {

                                    beginAtZero: true

                                }

                            }

                }

            }
        );

}


/*
|--------------------------------------------------------------------------
| References
|--------------------------------------------------------------------------
*/

function renderReferences(
    slide,
    preview
) {

    if (
        !slide.references ||
        slide.references.length === 0
    ) {

        return;

    }


    const references =
        document.createElement("div");

    references.className =
        "slide-references";


    slide.references.forEach(
        reference => {

            const item =
                document.createElement("div");

            item.textContent =
                reference;


            references.appendChild(item);

        }
    );


    preview.appendChild(
        references
    );

}


function updateTextColorLabel() {

    document
        .getElementById("text-color-value")
        .textContent =
        document.getElementById(
            "text-color"
        ).value;

}

/*
|--------------------------------------------------------------------------
| Slide image (cached so text edits don't re-download it)
|--------------------------------------------------------------------------
*/

function isLoadableImageUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function getCachedImage(url) {
    let entry = imageCache.get(url);

    if (entry) {
        // Move to the end so the least recently used entry is evicted first.
        imageCache.delete(url);
        imageCache.set(url, entry);
        return entry;
    }

    const image = new Image();
    image.className = "slide-image";
    image.alt = "Slide image";

    entry = { image, state: "loading" };

    image.addEventListener("load", () => { entry.state = "loaded"; });
    image.addEventListener("error", () => { entry.state = "error"; });

    imageCache.set(url, entry);

    if (imageCache.size > IMAGE_CACHE_LIMIT) {
        imageCache.delete(imageCache.keys().next().value);
    }

    // The request happens exactly once per URL, here.
    image.src = url;

    return entry;
}

function renderSlideImage(slide, preview) {
    const url = (slide.imageUrl || "").trim();
    const status = document.getElementById("image-status");

    if (!isLoadableImageUrl(url)) {
        if (status) {
            status.textContent = "";
            status.className = "image-status";
        }
        return;
    }

    const container = document.createElement("div");
    container.className = "slide-image-container";

    const loader = document.createElement("div");
    loader.className = "image-loader";
    loader.innerHTML =
        '<span class="image-spinner"></span><span>Loading image…</span>';

    const entry = getCachedImage(url);
    const image = entry.image;

    const showLoaded = () => {
        loader.remove();
        image.style.display = "block";

        if (status) {
            status.textContent = "Image loaded";
            status.className = "image-status success";
        }
    };

    const showError = () => {
        image.style.display = "none";
        loader.textContent = "Could not load image. Check the URL.";
        loader.classList.add("image-error");

        if (status) {
            status.textContent = "Image failed to load";
            status.className = "image-status error";
        }
    };

    container.appendChild(loader);
    container.appendChild(image);
    preview.appendChild(container);

    if (entry.state === "loaded") {
        showLoaded();
    } else if (entry.state === "error") {
        showError();
    } else {
        image.style.display = "none";

        if (status) {
            status.textContent = "Loading image…";
            status.className = "image-status loading";
        }

        // Ignore the result if this preview was rebuilt in the meantime.
        image.addEventListener("load", () => {
            if (container.isConnected) showLoaded();
        }, { once: true });

        image.addEventListener("error", () => {
            if (container.isConnected) showError();
        }, { once: true });
    }
}

// function renderSlideImage(slide, preview) {
//     if (!slide.imageUrl) {
//         return;
//     }

//     const container = document.createElement("div");
//     container.className = "slide-image-container";

//     const status = document.getElementById("image-status");
//     status.textContent = "Loading image…";
//     status.className = "image-status loading";

//     const loader = document.createElement("div");
//     loader.className = "image-loader";
//     loader.innerHTML = '<span class="image-spinner"></span><span>Loading image…</span>';

//     const image = document.createElement("img");
//     image.className = "slide-image";
//     image.alt = "Slide image";
//     image.style.display = "none";

//     image.onload = () => {
//         loader.remove();
//         image.style.display = "block";
//         status.textContent = "Image loaded";
//         status.className = "image-status success";
//     };

//     image.onerror = () => {
//         loader.textContent = "Could not load image. Check the URL.";
//         loader.classList.add("image-error");
//         status.textContent = "Image failed to load";
//         status.className = "image-status error";
//     };

//     container.appendChild(loader);
//     container.appendChild(image);
//     preview.appendChild(container);

//     image.src = slide.imageUrl;
// }
/*
|--------------------------------------------------------------------------
| Chart cleanup
|--------------------------------------------------------------------------
*/

function destroyChart() {

    if (!chartInstance) {
        return;
    }


    chartInstance.destroy();

    chartInstance = null;

}


/*
|--------------------------------------------------------------------------
| Preview slideshow
|--------------------------------------------------------------------------
*/

// function previewSlideshow() {

//     console.log(
//         "Slideshow preview:",
//         slideshow
//     );

//     /*
//      * Full-screen slideshow mode can be added here.
//      */

// }

/*
|--------------------------------------------------------------------------
| Local storage persistence
|--------------------------------------------------------------------------
*/

function normalizeSlides(slides) {
    // Fill in defaults for slides saved by older versions.
    return slides.map(slide => ({
        ...createSlide(slide),
        ...slide
    }));
}

function scheduleSave() {
    // Only the builder saves; the viewer shares this file but must not.
    if (!document.getElementById("builder")) {
        return;
    }

    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 300);
}

function saveState() {
    clearTimeout(saveTimer);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 1,
            savedAt: Date.now(),
            currentSlideIndex,
            settings: slideshow.settings,
            slides: slideshow.slides
        }));

        showSaveStatus("Saved");
    } catch (error) {
        // Storage can be full, blocked, or disabled (private mode).
        console.warn("Could not save slideshow:", error);
        showSaveStatus("Not saved");
    }
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return false;
        }

        const data = JSON.parse(raw);

        if (
            data.version !== 1 ||
            !Array.isArray(data.slides) ||
            data.slides.length === 0
        ) {
            return false;
        }

        slideshow.settings = data.settings || slideshow.settings;
        slideshow.slides = normalizeSlides(data.slides);

        currentSlideIndex = Math.min(
            Math.max(Number(data.currentSlideIndex) || 0, 0),
            slideshow.slides.length - 1
        );

        return true;
    } catch (error) {
        console.warn("Could not load saved slideshow:", error);
        return false;
    }
}

function showSaveStatus(text) {
    const status = document.getElementById("save-status");

    if (!status) {
        return;
    }

    status.textContent = text;
    status.classList.toggle("error", text === "Not saved");

    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
        status.textContent = "";
    }, 1500);
}

/*
|--------------------------------------------------------------------------
| New slideshow (wipes the saved one)
|--------------------------------------------------------------------------
*/

function newSlideshow() {
    console.log("hello!");
    if (
        hasUnsavedWork() &&
        !confirm(
            "Start a new presentation? The current one will be deleted " +
            "from this browser. Share it first if you want to keep it."
        )
    ) {
        return;
    }

    clearTimeout(saveTimer);

    slideshow.settings = {
        width: 1920,
        height: 1080,
        transition: "fade",
        duration: 5000,
        autoplay: false
    };

    slideshow.slides = [
        createSlide({
            layout: "title-subtitle",
            title: "My presentation"
        })
    ];

    currentSlideIndex = 0;

    document.getElementById("import-url").value = "";

    // render() overwrites the stored draft with the fresh blank slideshow.
    render();
}

/*
|--------------------------------------------------------------------------
| Share slideshow
|--------------------------------------------------------------------------
*/

// function shareSlideshow() {

//     console.log(
//         "Share functionality will be added later.",
//         slideshow
//     );

// }

function decodeSlideshow(encoded) {
    const base64 = encoded
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);

    const bytes = Uint8Array.from(
        binary,
        character => character.charCodeAt(0)
    );

    return JSON.parse(new TextDecoder().decode(bytes));
}

function encodeSlideshow(data) {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);

    let binary = "";
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

/*
|--------------------------------------------------------------------------
| Import slideshow from URL
|--------------------------------------------------------------------------
*/

function extractSlideshowData(text) {
    // Accepts a full view.html link, "#data=...", or "data=..."
    const match = text.trim().match(/(?:^|[#&?])data=([^&\s]+)/);
    return match ? match[1] : null;
}

function hasUnsavedWork() {
    return (
        slideshow.slides.length > 1 ||
        slideshow.slides[0].title !== "My presentation" ||
        slideshow.slides[0].subtitle ||
        slideshow.slides[0].imageUrl
    );
}

function importSlideshow() {
    const input = document.getElementById("import-url");

    try {
        const encoded = extractSlideshowData(input.value);

        if (!encoded) {
            throw new Error("No slideshow data found in the link");
        }

        const data = decodeSlideshow(encoded);

        if (
            data.version !== 1 ||
            !Array.isArray(data.slides) ||
            data.slides.length === 0
        ) {
            throw new Error("Unsupported or empty slideshow");
        }

        if (
            hasUnsavedWork() &&
            !confirm("Importing will replace your current slideshow. Continue?")
        ) {
            return;
        }

        // Same normalization as the viewer: fill in defaults for older slides.
        slideshow.settings = data.settings || slideshow.settings;
        slideshow.slides = data.slides.map(slide => ({
            ...createSlide(slide),
            ...slide
        }));

        currentSlideIndex = 0;
        input.value = "";
        input.classList.remove("invalid");

        document.querySelector(".preview-toolbar").classList.remove("import-open");
        document.getElementById("import-toggle").setAttribute("aria-expanded", "false");

        render();

    } catch (error) {
        console.error("Could not import slideshow:", error);
        input.classList.add("invalid");
        input.title = "This link is invalid or incomplete.";
    }
}

// async function shareSlideshow() {
//     // Include only the data needed to reconstruct the presentation.
//     const data = {
//         version: 1,
//         settings: slideshow.settings,
//         slides: slideshow.slides
//     };

//     const encoded = encodeSlideshow(data);
//     const url = new URL("view.html", window.location.href);
//     url.hash = `data=${encoded}`;

//     try {
//         await navigator.clipboard.writeText(url.href);
//         alert("Share link copied to clipboard!");
//     } catch (error) {
//         // Fallback if clipboard access is unavailable.
//         window.prompt("Copy your slideshow link:", url.href);
//     }
// }

async function shareSlideshow() {
    const url = getSlideshowShareUrl();

    try {
        await navigator.clipboard.writeText(url);
        alert("Share link copied to clipboard!");
    } catch (error) {
        window.prompt("Copy your slideshow link:", url);
    }
}


function getSlideshowShareUrl() {
    const data = {
        version: 1,
        settings: slideshow.settings,
        slides: slideshow.slides
    };

    const encoded = encodeSlideshow(data);
    const url = new URL("view.html", window.location.href);
    url.hash = `data=${encoded}`;

    return url.href;
}

function openQrModal() {
    const modal = document.getElementById("qr-modal");
    const qrContainer = document.getElementById("qr-code");

    if (typeof QRCode === "undefined") {
        qrContainer.innerHTML =
            '<p id="qr-code-error">The QR code library could not load. Check your internet connection and try again.</p>';
        modal.hidden = false;
        document.getElementById("qr-modal-close").focus();
        return;
    }

    // Clear any QR code from the previous opening.
    qrContainer.replaceChildren();

    const shareUrl = getSlideshowShareUrl();

    new QRCode(qrContainer, {
        text: shareUrl,
        // width: 220,
        // height: 220,
        width: 256,
        height: 256,
        colorDark: "#111827",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    });

    modal.hidden = false;
    document.getElementById("qr-modal-close").focus();
}

function closeQrModal() {
    document.getElementById("qr-modal").hidden = true;
    document.getElementById("generate-qr-button").focus();
}

document.addEventListener("DOMContentLoaded", () => {
    const generateButton = document.getElementById("generate-qr-button");
    const closeButton = document.getElementById("qr-modal-close");
    const modal = document.getElementById("qr-modal");
    const copyButton = document.getElementById("qr-copy-link");

    if (!generateButton || !modal) return;

    generateButton.addEventListener("click", openQrModal);
    closeButton.addEventListener("click", closeQrModal);

    // Close when clicking the dark overlay, but not the popup itself.
    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeQrModal();
        }
    });

    // Allow closing with Escape.
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) {
            closeQrModal();
        }
    });

    copyButton.addEventListener("click", async () => {
        const url = getSlideshowShareUrl();

        try {
            await navigator.clipboard.writeText(url);
            copyButton.textContent = "Link copied!";
        } catch (error) {
            window.prompt("Copy your slideshow link:", url);
        }
    });
});



